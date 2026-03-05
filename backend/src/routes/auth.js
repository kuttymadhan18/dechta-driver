// src/routes/auth.js
const { sendOtpHandler, verifyOtpHandler, refreshTokenHandler } = require('../controllers/authController');

async function authRoutes(fastify, options) {
  // POST /api/auth/send-otp
  fastify.post('/send-otp', {
    schema: {
      body: {
        type: 'object',
        required: ['mobile'],
        properties: {
          mobile: { type: 'string', minLength: 10, maxLength: 10 },
        },
      },
    },
    handler: sendOtpHandler,
  });

  // POST /api/auth/verify-otp
  fastify.post('/verify-otp', {
    schema: {
      body: {
        type: 'object',
        required: ['mobile', 'otp'],
        properties: {
          mobile: { type: 'string', minLength: 10, maxLength: 10 },
          otp: { type: 'string', minLength: 4, maxLength: 4 },
        },
      },
    },
    handler: verifyOtpHandler,
  });

  // POST /api/auth/refresh — requires valid token
  fastify.post('/refresh', { handler: refreshTokenHandler });
}

module.exports = authRoutes;
