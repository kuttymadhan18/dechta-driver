// src/middleware/auth.js
// ──────────────────────────────────────────────────────────────
// Fastify preHandler — verifies JWT and attaches driver to request
// Uses PostgreSQL
// ──────────────────────────────────────────────────────────────
const { query } = require('../config/db');

async function authenticate(request, reply) {
  try {
    await request.jwtVerify();

    const driverId = request.user.driverId;

    const { rows } = await query(
      `SELECT id, mobile_number, driver_id, full_name, is_approved, status
       FROM driver_profiles WHERE id = $1`,
      [driverId]
    );

    if (!rows.length) {
      return reply.code(401).send({ success: false, message: 'Driver not found' });
    }

    request.driver = rows[0];
  } catch (err) {
    reply.code(401).send({ success: false, message: 'Unauthorized. Invalid or expired token.' });
  }
}

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
