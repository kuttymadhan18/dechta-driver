// src/controllers/authController.js
const { sendOtp, verifyOtp } = require('../services/otpService');
const { query }              = require('../config/db');
const { v4: uuidv4 }         = require('uuid');

// ──────────────────────────────────────────────────────────────
// POST /api/auth/send-otp
// ──────────────────────────────────────────────────────────────
async function sendOtpHandler(request, reply) {
  const { mobile } = request.body;

  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    return reply.code(400).send({ success: false, message: 'Invalid Indian mobile number' });
  }

  try {
    const result = await sendOtp(mobile);
    return reply.send({
      success: true,
      message: 'OTP sent successfully',
      provider: result.provider,
      ...(result.provider === 'mock' && { otp_for_testing: result.otp_for_testing }),
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// ──────────────────────────────────────────────────────────────
async function verifyOtpHandler(request, reply) {
  const { mobile, otp } = request.body;

  if (!mobile || !otp) {
    return reply.code(400).send({ success: false, message: 'Mobile and OTP are required' });
  }

  try {
    const otpResult = await verifyOtp(mobile, otp);
    if (!otpResult.success) {
      return reply.code(400).send({ success: false, message: otpResult.message });
    }

    // Check existing driver
    const { rows: existing } = await query(
      `SELECT * FROM driver_profiles WHERE mobile_number = $1`,
      [mobile]
    );

    let driver     = existing[0];
    let isNewDriver = false;

    if (!driver) {
      isNewDriver = true;
      const referralCode = `QC${mobile.slice(-4)}${uuidv4().slice(0, 4).toUpperCase()}`;

      const { rows: created } = await query(
        `INSERT INTO driver_profiles
           (mobile_number, full_name, referral_code, is_approved, is_online, status)
         VALUES ($1, '', $2, false, false, 'offline')
         RETURNING *`,
        [mobile, referralCode]
      );

      driver = created[0];

      // Create driver_stats row
      await query(
        `INSERT INTO driver_stats (driver_id) VALUES ($1) ON CONFLICT (driver_id) DO NOTHING`,
        [driver.id]
      );
    }

    // Issue JWT
    const token = await reply.jwtSign(
      {
        driverId:   driver.id,
        mobile:     driver.mobile_number,
        isApproved: driver.is_approved,
      },
      { expiresIn: '30d' }
    );

    return reply.send({
      success: true,
      token,
      isNewDriver,
      driver: {
        id:           driver.id,
        driverId:     driver.driver_id,
        fullName:     driver.full_name,
        mobile:       driver.mobile_number,
        isApproved:   driver.is_approved,
        isOnline:     driver.is_online,
        status:       driver.status,
        avatarUrl:    driver.avatar_url,
        referralCode: driver.referral_code,
      },
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, message: 'Server error during verification' });
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/auth/refresh-token
// ──────────────────────────────────────────────────────────────
async function refreshTokenHandler(request, reply) {
  try {
    await request.jwtVerify();
    const { driverId } = request.user;

    const { rows } = await query(
      `SELECT id, mobile_number, driver_id, full_name, is_approved, status
       FROM driver_profiles WHERE id = $1`,
      [driverId]
    );

    if (!rows.length) {
      return reply.code(404).send({ success: false, message: 'Driver not found' });
    }

    const driver = rows[0];
    const token  = await reply.jwtSign(
      { driverId: driver.id, mobile: driver.mobile_number, isApproved: driver.is_approved },
      { expiresIn: '30d' }
    );

    return reply.send({ success: true, token });
  } catch (err) {
    return reply.code(401).send({ success: false, message: 'Invalid token' });
  }
}

module.exports = { sendOtpHandler, verifyOtpHandler, refreshTokenHandler };
