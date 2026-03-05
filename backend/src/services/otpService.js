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
// Send OTP via MSG91 (India SMS — current production option)
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

// ══════════════════════════════════════════════════════════════
// FUTURE TWILIO INTEGRATION START
// ══════════════════════════════════════════════════════════════
//
// STEP 1 — Install Twilio package:
//   npm install twilio
//
// STEP 2 — Add to your .env file:
//   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_AUTH_TOKEN=your_auth_token_here
//   TWILIO_PHONE_NUMBER=+1XXXXXXXXXX   (your Twilio number)
//
// STEP 3 — Add to Render environment variables (same keys above)
//
// STEP 4 — Uncomment and use this function:
//
// const twilio = require('twilio');
//
// async function sendViaTwilio(mobileNumber, otp) {
//   const client = twilio(
//     process.env.TWILIO_ACCOUNT_SID,
//     process.env.TWILIO_AUTH_TOKEN
//   );
//   const message = await client.messages.create({
//     body: `Your QC Logistics OTP is: ${otp}. Valid for 5 minutes.`,
//     from: process.env.TWILIO_PHONE_NUMBER,
//     to: `+91${mobileNumber}`,
//   });
//   return message.sid;
// }
//
// STEP 5 — In sendOtp() below, add this case in the provider switch:
//
//   if (provider === 'twilio') {
//     try {
//       const sid = await sendViaTwilio(mobileNumber, otp);
//       return { success: true, provider: 'twilio', messageSid: sid };
//     } catch (err) {
//       console.error('[Twilio Error]', err.message);
//       throw new Error('Failed to send SMS via Twilio. Please try again.');
//     }
//   }
//
// STEP 6 — Update OTP_PROVIDER in .env:
//   OTP_PROVIDER=twilio
//
// ══════════════════════════════════════════════════════════════
// FUTURE TWILIO INTEGRATION END
// ══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────
// Send OTP — switches between mock / msg91 / twilio based on env
// ──────────────────────────────────────────────────────────────
async function sendOtp(mobileNumber) {
  // STEP 3 — Backend validation: Indian mobile number format
  if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
    throw new Error('Invalid Indian mobile number. Must be 10 digits starting with 6-9.');
  }

  const otp = generateOtp();
  const expiresAt = new Date(
    Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '5') * 60 * 1000
  );

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
    // Fallback: upsert failed (no unique constraint) — insert fresh record
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

  // ── MOCK MODE (Demo / Development) ────────────────────────
  if (provider === 'mock') {
    console.log(
      `\n📱 [MOCK OTP] Mobile: ${mobileNumber} | OTP: ${otp} | Expires: ${expiresAt.toLocaleString()}\n`
    );
    // otp_for_testing is returned so frontend can display it on screen in demo mode
    return { success: true, provider: 'mock', otp_for_testing: otp };
  }

  // ── MSG91 (India SMS) ──────────────────────────────────────
  if (provider === 'msg91') {
    try {
      const result = await sendViaMSG91(mobileNumber, otp);
      return { success: true, provider: 'msg91', msgResult: result };
    } catch (err) {
      console.error('[MSG91 Error]', err.message);
      throw new Error('Failed to send SMS. Please try again.');
    }
  }

  // ── TWILIO (uncomment block above and add case here when ready) ──
  // if (provider === 'twilio') { ... }

  throw new Error(`Unknown OTP_PROVIDER: "${provider}". Valid options: mock, msg91`);
}

// ──────────────────────────────────────────────────────────────
// Verify OTP
// ──────────────────────────────────────────────────────────────
async function verifyOtp(mobileNumber, enteredOtp) {
  // Backend validation
  if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
    return { success: false, message: 'Invalid mobile number format.' };
  }
  if (!/^\d{4}$/.test(enteredOtp)) {
    return { success: false, message: 'OTP must be 4 digits.' };
  }

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

  // Increment attempts first
  await supabaseAdmin
    .from('otp_verification')
    .update({ attempts: record.attempts + 1 })
    .eq('id', record.id);

  // Verify OTP value
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