// src/routes/driver.js
const { authenticate, requireApproved } = require('../middleware/auth');
const {
  getProfile, updateProfile, completeRegistration,
  updateOnlineStatus, updateGpsLocation,
  uploadAvatar, uploadDocument,
  getNotifications, markNotificationsRead,
} = require('../controllers/driverController');

async function driverRoutes(fastify, options) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // GET /api/driver/profile
  fastify.get('/profile', { handler: getProfile });

  // PUT /api/driver/profile
  fastify.put('/profile', { handler: updateProfile });

  // POST /api/driver/register — full onboarding form
  fastify.post('/register', { handler: completeRegistration });

  // PUT /api/driver/online-status
  fastify.put('/online-status', {
    preHandler: [requireApproved],
    schema: {
      body: {
        type: 'object',
        required: ['isOnline'],
        properties: { isOnline: { type: 'boolean' } },
      },
    },
    handler: updateOnlineStatus,
  });

  // POST /api/driver/gps — GPS ping during trip
  fastify.post('/gps', {
    schema: {
      body: {
        type: 'object',
        required: ['latitude', 'longitude'],
        properties: {
          tripId: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          accuracy: { type: 'number' },
          speed: { type: 'number' },
          heading: { type: 'number' },
        },
      },
    },
    handler: updateGpsLocation,
  });

  // POST /api/driver/upload-avatar (multipart)
  fastify.post('/upload-avatar', { handler: uploadAvatar });

  // POST /api/driver/upload-document (multipart)
  fastify.post('/upload-document', { handler: uploadDocument });

  // GET /api/driver/notifications
  fastify.get('/notifications', { handler: getNotifications });

  // PUT /api/driver/notifications/mark-read
  fastify.put('/notifications/mark-read', { handler: markNotificationsRead });
}

module.exports = driverRoutes;
