// src/routes/orders.js
const { authenticate, requireApproved } = require('../middleware/auth');
const {
  getAvailableOrders, getActiveTrip, acceptOrder, ignoreOrder,
  arrivedAtPickup, confirmPickup, arrivedAtDropoff,
  completeDelivery, cancelTrip, getOrderHistory,
} = require('../controllers/ordersController');

async function orderRoutes(fastify, options) {
  fastify.addHook('preHandler', authenticate);

  // ── Orders ──────────────────────────────────────────────────

  // GET /api/orders/available
  fastify.get('/available', {
    preHandler: [requireApproved],
    handler: getAvailableOrders,
  });

  // GET /api/orders/history
  fastify.get('/history', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['Completed', 'Cancelled', 'Missed'] },
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
      },
    },
    handler: getOrderHistory,
  });

  // GET /api/orders/active — active trip if any
  fastify.get('/active', { handler: getActiveTrip });

  // POST /api/orders/:orderId/accept
  fastify.post('/:orderId/accept', {
    preHandler: [requireApproved],
    schema: {
      params: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
        required: ['orderId'],
      },
    },
    handler: acceptOrder,
  });

  // POST /api/orders/:orderId/ignore
  fastify.post('/:orderId/ignore', { handler: ignoreOrder });

  // ── Trip lifecycle ───────────────────────────────────────────

  // POST /api/orders/trips/:tripId/arrived-pickup
  fastify.post('/trips/:tripId/arrived-pickup', { handler: arrivedAtPickup });

  // POST /api/orders/trips/:tripId/confirm-pickup (multipart photo)
  fastify.post('/trips/:tripId/confirm-pickup', { handler: confirmPickup });

  // POST /api/orders/trips/:tripId/arrived-dropoff
  fastify.post('/trips/:tripId/arrived-dropoff', { handler: arrivedAtDropoff });

  // POST /api/orders/trips/:tripId/complete
  fastify.post('/trips/:tripId/complete', {
    schema: {
      params: { type: 'object', properties: { tripId: { type: 'string' } }, required: ['tripId'] },
      body: {
        type: 'object',
        required: ['otp'],
        properties: { otp: { type: 'string', minLength: 4, maxLength: 4 } },
      },
    },
    handler: completeDelivery,
  });

  // POST /api/orders/trips/:tripId/cancel
  fastify.post('/trips/:tripId/cancel', {
    schema: {
      body: {
        type: 'object',
        required: ['reason'],
        properties: { reason: { type: 'string', minLength: 3 } },
      },
    },
    handler: cancelTrip,
  });
}

module.exports = orderRoutes;
