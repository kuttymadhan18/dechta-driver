// src/services/otpService.js
const axios = require('axios');
const { supabaseAdmin } = require('../config/supabase');

// ──────────────────────────────────────────────────────────────
// Generate a 4-digit OTP
// ──────────────────────────────────────────────────────────────
function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ──────────────────────────────────────────────────────────────
// Send OTP via MSG91 (production)
// ──────────────────────────────────────────────────────────────
async function sendViaMSG91(mobileNumber, otp) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const senderId = process.env.MSG91_SENDER_ID || 'QCLOGX';

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
// Send OTP — switches between mock and MSG91 based on env
// ──────────────────────────────────────────────────────────────
async function sendOtp(mobileNumber) {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '5') * 60 * 1000);

  // Store OTP in DB (upsert on mobile_number)
  const { error: dbError } = await supabaseAdmin
    .from('otp_verification')
    .upsert(
      {
        mobile_number: mobileNumber,
        phone: mobileNumber,
        otp,
        is_verified: false,
        attempts: 0,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      },
      { onConflict: 'mobile_number' }
    );

  if (dbError) {
    // Table might not have unique on mobile_number — do insert instead
    await supabaseAdmin.from('otp_verification').insert({
      mobile_number: mobileNumber,
      phone: mobileNumber,
      otp,
      is_verified: false,
      attempts: 0,
      expires_at: expiresAt.toISOString(),
    });
  }

  const provider = process.env.OTP_PROVIDER || 'mock';

  if (provider === 'mock') {
    // DEMO MODE: log OTP to console — replace with MSG91 in production
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

  throw new Error(`Unknown OTP_PROVIDER: ${provider}`);
}

// ──────────────────────────────────────────────────────────────
// Verify OTP
// ──────────────────────────────────────────────────────────────
async function verifyOtp(mobileNumber, enteredOtp) {
  const { data: records, error } = await supabaseAdmin
    .from('otp_verification')
    .select('*')
    .eq('mobile_number', mobileNumber)
    .eq('is_verified', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !records || records.length === 0) {
    return { success: false, message: 'OTP not found. Please request a new one.' };
  }

  const record = records[0];

  // Check expiry
  if (new Date(record.expires_at) < new Date()) {
    return { success: false, message: 'OTP has expired. Please request a new one.' };
  }

  // Check attempts (max 3)
  if (record.attempts >= 3) {
    return { success: false, message: 'Too many attempts. Please request a new OTP.' };
  }

  // Increment attempts
  await supabaseAdmin
    .from('otp_verification')
    .update({ attempts: record.attempts + 1 })
    .eq('id', record.id);

  // Verify OTP
  if (record.otp !== enteredOtp) {
    return { success: false, message: 'Incorrect OTP. Please try again.' };
  }

  // Mark as verified
  await supabaseAdmin
    .from('otp_verification')
    .update({ is_verified: true })
    .eq('id', record.id);

  return { success: true, message: 'OTP verified successfully.' };
}

// ──────────────────────────────────────────────────────────────
// Generate delivery OTP (4-digit, stored on orders table)
// ──────────────────────────────────────────────────────────────
async function generateDeliveryOtp(orderId) {
  const otp = generateOtp();

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ delivery_otp: otp })
    .eq('id', orderId);

  if (error) throw new Error('Failed to generate delivery OTP');

  return otp;
}

module.exports = { sendOtp, verifyOtp, generateDeliveryOtp };
