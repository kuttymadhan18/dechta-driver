// src/services/otpService.js
// ──────────────────────────────────────────────────────────────
// OTP Service
// Provider: mock (dev) | msg91 (production)
// ──────────────────────────────────────────────────────────────
const axios = require('axios');
const { query } = require('../config/db');

function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function sendViaMSG91(mobileNumber, otp) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  const response = await axios.post(
    'https://api.msg91.com/api/v5/otp',
    {
      template_id: templateId,
      mobile: `91${mobileNumber}`,
      authkey: authKey,
      otp,
    },
    { headers: { 'Content-Type': 'application/json' } }
  );
  return response.data;
}

// ──────────────────────────────────────────────────────────────
// Send OTP — stores in otp_verification table (PostgreSQL)
// ──────────────────────────────────────────────────────────────
async function sendOtp(mobileNumber) {
  if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
    throw new Error('Invalid Indian mobile number. Must be 10 digits starting with 6-9.');
  }

  const otp = generateOtp();
  const expiryMin = parseInt(process.env.OTP_EXPIRY_MINUTES || '5');
  const expiresAt = new Date(Date.now() + expiryMin * 60 * 1000);

  // Upsert: delete old record first then insert fresh (simpler than ON CONFLICT on text col)
  await query(
    `DELETE FROM otp_verification WHERE mobile_number = $1`,
    [mobileNumber]
  );

  await query(
    `INSERT INTO otp_verification (mobile_number, phone, otp, is_verified, attempts, expires_at, created_at)
     VALUES ($1, $1, $2, false, 0, $3, NOW())`,
    [mobileNumber, otp, expiresAt]
  );

  const provider = process.env.OTP_PROVIDER || 'mock';

  if (provider === 'mock') {
    console.log(`\n📱 [MOCK OTP] Mobile: ${mobileNumber} | OTP: ${otp} | Expires: ${expiresAt.toLocaleString()}\n`);
    return { success: true, provider: 'mock', otp_for_testing: otp };
  }

  if (provider === 'msg91') {
    try {
      const result = await sendViaMSG91(mobileNumber, otp);
      return { success: true, provider: 'msg91', msgResult: result };
    } catch (err) {
      console.error('[MSG91 Error]', err.message);
      throw new Error('Failed to send SMS. Please try again.');
    }
  }

  throw new Error(`Unknown OTP_PROVIDER: "${provider}". Valid options: mock, msg91`);
}

// ──────────────────────────────────────────────────────────────
// Verify OTP
// ──────────────────────────────────────────────────────────────
async function verifyOtp(mobileNumber, enteredOtp) {
  if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
    return { success: false, message: 'Invalid mobile number format.' };
  }
  if (!/^\d{4}$/.test(enteredOtp)) {
    return { success: false, message: 'OTP must be 4 digits.' };
  }

  const { rows } = await query(
    `SELECT * FROM otp_verification
     WHERE mobile_number = $1 AND is_verified = false
     ORDER BY created_at DESC LIMIT 1`,
    [mobileNumber]
  );

  if (!rows.length) {
    return { success: false, message: 'OTP not found. Please request a new one.' };
  }

  const record = rows[0];

  if (new Date(record.expires_at) < new Date()) {
    return { success: false, message: 'OTP has expired. Please request a new one.' };
  }

  if (record.attempts >= 3) {
    return { success: false, message: 'Too many attempts. Please request a new OTP.' };
  }

  // Increment attempts
  await query(
    `UPDATE otp_verification SET attempts = attempts + 1 WHERE id = $1`,
    [record.id]
  );

  if (record.otp !== enteredOtp) {
    return { success: false, message: 'Incorrect OTP. Please try again.' };
  }

  // Mark verified
  await query(
    `UPDATE otp_verification SET is_verified = true WHERE id = $1`,
    [record.id]
  );

  return { success: true, message: 'OTP verified successfully.' };
}

// ──────────────────────────────────────────────────────────────
// Generate delivery OTP — stores directly on orders table
// ──────────────────────────────────────────────────────────────
async function generateDeliveryOtp(orderId) {
  const otp = generateOtp();

  await query(
    `UPDATE orders SET delivery_otp = $1 WHERE id = $2`,
    [otp, orderId]
  );

  return otp;
}

module.exports = { sendOtp, verifyOtp, generateDeliveryOtp };
