// src/controllers/authController.js
const { sendOtp, verifyOtp } = require('../services/otpService');
const { supabaseAdmin } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

// ──────────────────────────────────────────────────────────────
// POST /api/auth/send-otp
// Body: { mobile: "9876543210" }
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
      // Only expose test OTP in mock/dev mode
      ...(result.provider === 'mock' && { otp_for_testing: result.otp_for_testing }),
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// Body: { mobile: "9876543210", otp: "1234" }
// Returns: { token, driver, isNewDriver }
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

    // Check if driver profile exists
    const { data: existingDriver } = await supabaseAdmin
      .from('driver_profiles')
      .select('*')
      .eq('mobile_number', mobile)
      .single();

    let driver = existingDriver;
    let isNewDriver = false;

    if (!driver) {
      // New driver — create a minimal profile
      isNewDriver = true;
      const referralCode = `QC${mobile.slice(-4)}${uuidv4().slice(0, 4).toUpperCase()}`;

      const { data: newDriver, error: createError } = await supabaseAdmin
        .from('driver_profiles')
        .insert({
          mobile_number: mobile,
          full_name: '',
          referral_code: referralCode,
          is_approved: false,
          is_online: false,
          status: 'offline',
        })
        .select()
        .single();

      if (createError) {
        request.log.error(createError);
        return reply.code(500).send({ success: false, message: 'Failed to create driver profile' });
      }

      // Create driver_stats row
      await supabaseAdmin.from('driver_stats').insert({ driver_id: newDriver.id });

      driver = newDriver;
    }

    // Issue JWT
    const token = await reply.jwtSign(
      {
        driverId: driver.id,
        mobile: driver.mobile_number,
        isApproved: driver.is_approved,
      },
      { expiresIn: '30d' }
    );

    return reply.send({
      success: true,
      token,
      isNewDriver,
      driver: {
        id: driver.id,
        driverId: driver.driver_id,
        fullName: driver.full_name,
        mobile: driver.mobile_number,
        isApproved: driver.is_approved,
        isOnline: driver.is_online,
        status: driver.status,
        avatarUrl: driver.avatar_url,
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
// Refreshes JWT for already-authenticated driver
// ──────────────────────────────────────────────────────────────
async function refreshTokenHandler(request, reply) {
  try {
    await request.jwtVerify();
    const { driverId } = request.user;

    const { data: driver } = await supabaseAdmin
      .from('driver_profiles')
      .select('id, mobile_number, driver_id, full_name, is_approved, status')
      .eq('id', driverId)
      .single();

    if (!driver) {
      return reply.code(404).send({ success: false, message: 'Driver not found' });
    }

    const token = await reply.jwtSign(
      { driverId: driver.id, mobile: driver.mobile_number, isApproved: driver.is_approved },
      { expiresIn: '30d' }
    );

    return reply.send({ success: true, token });
  } catch (err) {
    return reply.code(401).send({ success: false, message: 'Invalid token' });
  }
}

module.exports = { sendOtpHandler, verifyOtpHandler, refreshTokenHandler };
