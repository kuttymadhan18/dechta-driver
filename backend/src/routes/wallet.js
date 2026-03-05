// src/routes/wallet.js
const { authenticate } = require('../middleware/auth');
const { getWallet, requestWithdrawal, payDues } = require('../controllers/walletController');

async function walletRoutes(fastify, options) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/wallet
  fastify.get('/', { handler: getWallet });

  // POST /api/wallet/withdraw
  fastify.post('/withdraw', {
    schema: {
      body: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', minimum: 100 },
          upiId: { type: 'string' },
        },
      },
    },
    handler: requestWithdrawal,
  });

  // POST /api/wallet/pay-dues
  fastify.post('/pay-dues', {
    schema: {
      body: {
        type: 'object',
        required: ['amount'],
        properties: { amount: { type: 'number', minimum: 1 } },
      },
    },
    handler: payDues,
  });
}

module.exports = walletRoutes;
