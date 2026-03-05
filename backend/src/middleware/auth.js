// src/middleware/auth.js
const { supabaseAdmin } = require('../config/supabase');

// ──────────────────────────────────────────────────────────────
// Fastify preHandler — verifies JWT and attaches driver to request
// ──────────────────────────────────────────────────────────────
async function authenticate(request, reply) {
  try {
    await request.jwtVerify();

    const driverId = request.user.driverId;

    // Fetch driver profile from DB
    const { data: driver, error } = await supabaseAdmin
      .from('driver_profiles')
      .select('id, mobile_number, driver_id, full_name, is_approved, status')
      .eq('id', driverId)
      .single();

    if (error || !driver) {
      return reply.code(401).send({ success: false, message: 'Driver not found' });
    }

    // Attach driver to request for downstream use
    request.driver = driver;
  } catch (err) {
    reply.code(401).send({ success: false, message: 'Unauthorized. Invalid or expired token.' });
  }
}

// ──────────────────────────────────────────────────────────────
// Check if driver is approved before allowing sensitive actions
// ──────────────────────────────────────────────────────────────
async function requireApproved(request, reply) {
  if (!request.driver) {
    return reply.code(401).send({ success: false, message: 'Not authenticated' });
  }
  if (!request.driver.is_approved) {
    return reply.code(403).send({
      success: false,
      message: 'Your account is pending approval. Please wait for admin verification.',
    });
  }
}

module.exports = { authenticate, requireApproved };
