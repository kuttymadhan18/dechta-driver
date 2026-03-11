// src/server.js
'use strict';

require('dotenv').config();

const Fastify = require('fastify');

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
  trustProxy: true,
});

// ──────────────────────────────────────────────────────────────
// Register plugins
// ──────────────────────────────────────────────────────────────
async function registerPlugins() {
  await fastify.register(require('@fastify/cors'), {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await fastify.register(require('@fastify/helmet'), { contentSecurityPolicy: false });

  await fastify.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SECRET || 'dechta-driver-secret-change-in-production',
    sign: { expiresIn: '30d' },
  });

  await fastify.register(require('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.headers['x-forwarded-for'] || req.ip,
    errorResponseBuilder: () => ({ success: false, message: 'Too many requests. Please slow down.' }),
  });

  await fastify.register(require('@fastify/multipart'), {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });
}

// ──────────────────────────────────────────────────────────────
// Register routes
// ──────────────────────────────────────────────────────────────
async function registerRoutes() {
  await fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
  await fastify.register(require('./routes/driver'), { prefix: '/api/driver' });
  await fastify.register(require('./routes/orders'), { prefix: '/api/orders' });
  await fastify.register(require('./routes/earnings'), { prefix: '/api/earnings' });
  await fastify.register(require('./routes/wallet'), { prefix: '/api/wallet' });
  await fastify.register(require('./routes/misc'), { prefix: '/api' });
}

// ──────────────────────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────────────────────
fastify.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  service: 'Dechta Driver Backend',
  version: '2.0.0',
  environment: process.env.NODE_ENV || 'development',
  database: 'PostgreSQL',
}));

fastify.get('/', async () => ({ message: 'Dechta Driver API is running 🚚', docs: '/api/docs' }));

// ──────────────────────────────────────────────────────────────
// Global error handler
// ──────────────────────────────────────────────────────────────
fastify.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  if (error.validation) {
    return reply.code(400).send({ success: false, message: 'Validation error', details: error.validation });
  }
  if (error.statusCode === 429) {
    return reply.code(429).send({ success: false, message: error.message });
  }
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
    return reply.code(401).send({ success: false, message: 'Unauthorized' });
  }

  return reply.code(error.statusCode || 500).send({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
});

fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({ success: false, message: `Route ${request.method} ${request.url} not found` });
});

// ──────────────────────────────────────────────────────────────
// PostgreSQL LISTEN/NOTIFY for real-time new orders
// Triggers socket broadcast to drivers
// ──────────────────────────────────────────────────────────────
async function startOrderListener(broadcastNewOrder) {
  const { getClient } = require('./config/db');

  let listenClient;
  let retryCount = 0;
  const maxRetries = 10;

  async function connect() {
    try {
      listenClient = await getClient();

      await listenClient.query('LISTEN new_order');
      fastify.log.info('[PG LISTEN] Listening for new_order notifications');

      listenClient.on('notification', (msg) => {
        if (msg.channel === 'new_order') {
          try {
            const order = JSON.parse(msg.payload);
            fastify.log.info({ orderId: order.id }, '[PG LISTEN] New order — broadcasting to drivers');
            broadcastNewOrder(order);
          } catch (e) {
            fastify.log.warn('[PG LISTEN] Failed to parse notification payload:', e.message);
          }
        }
      });

      listenClient.on('error', async (err) => {
        fastify.log.error('[PG LISTEN] Client error:', err.message);
        listenClient.release();
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(connect, 3000 * retryCount);
        }
      });

      listenClient.on('end', async () => {
        fastify.log.warn('[PG LISTEN] Client disconnected — reconnecting...');
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(connect, 3000 * retryCount);
        }
      });

      retryCount = 0;
    } catch (err) {
      fastify.log.error('[PG LISTEN] Failed to connect:', err.message);
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(connect, 3000 * retryCount);
      }
    }
  }

  await connect();
}

// ──────────────────────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────────────────────
async function start() {
  try {
    // Test DB connection first
    const { query } = require('./config/db');
    await query('SELECT 1');
    fastify.log.info('[DB] PostgreSQL connected ✓');

    await registerPlugins();
    await registerRoutes();
    await fastify.ready();

    const httpServer = fastify.server;

    // Initialize Socket.io
    const { initSocket, broadcastNewOrder } = require('./services/socketService');
    initSocket(httpServer);

    // Start PG LISTEN/NOTIFY for real-time order broadcast
    // (vendor app triggers NOTIFY new_order via DB trigger)
    await startOrderListener(broadcastNewOrder);

    const PORT = parseInt(process.env.PORT || '3000', 10);
    await fastify.listen({ port: PORT, host: '0.0.0.0' });

    console.log(`
╔════════════════════════════════════════════════╗
║   🚚 Dechta Driver Backend is running          ║
║   Port    : ${PORT}                             
║   Env     : ${process.env.NODE_ENV || 'development'}                      
║   DB      : PostgreSQL (dechta)                 
║   Health  : http://localhost:${PORT}/health     
╚════════════════════════════════════════════════╝
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => { await fastify.close(); process.exit(0); });
process.on('SIGINT', async () => { await fastify.close(); process.exit(0); });

start();
