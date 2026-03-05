// src/server.js
'use strict';

require('dotenv').config();

const Fastify = require('fastify');
const http = require('http');

// ──────────────────────────────────────────────────────────────
// Create Fastify instance
// ──────────────────────────────────────────────────────────────
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
  // CORS
  await fastify.register(require('@fastify/cors'), {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Helmet — security headers
  await fastify.register(require('@fastify/helmet'), {
    contentSecurityPolicy: false, // disable for API
  });

  // JWT
  await fastify.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SECRET || 'qc-driver-super-secret-change-in-production',
    sign: { expiresIn: '30d' },
  });

  // Rate limiting
  await fastify.register(require('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.headers['x-forwarded-for'] || req.ip,
    errorResponseBuilder: () => ({
      success: false,
      message: 'Too many requests. Please slow down.',
    }),
  });

  // Multipart (for file uploads)
  await fastify.register(require('@fastify/multipart'), {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max per file
      files: 1,
    },
  });
}

// ──────────────────────────────────────────────────────────────
// Register routes under /api prefix
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
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'QC Driver Backend',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };
});

fastify.get('/', async (request, reply) => {
  return { message: 'QC Logistics Driver API is running 🚚', docs: '/api/docs' };
});

// ──────────────────────────────────────────────────────────────
// Global error handler
// ──────────────────────────────────────────────────────────────
fastify.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  // Validation errors
  if (error.validation) {
    return reply.code(400).send({
      success: false,
      message: 'Validation error',
      details: error.validation,
    });
  }

  // Rate limit
  if (error.statusCode === 429) {
    return reply.code(429).send({
      success: false,
      message: error.message,
    });
  }

  // JWT errors
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
    return reply.code(401).send({ success: false, message: 'Unauthorized' });
  }

  // Generic server error
  return reply.code(error.statusCode || 500).send({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
});

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    success: false,
    message: `Route ${request.method} ${request.url} not found`,
  });
});

// ──────────────────────────────────────────────────────────────
// Bootstrap — create HTTP server, attach Socket.io, start
// ──────────────────────────────────────────────────────────────
async function start() {
  try {
    await registerPlugins();
    await registerRoutes();

    // Get Fastify's underlying Node HTTP server
    await fastify.ready();
    const httpServer = fastify.server;

    // Initialize Socket.io on the same HTTP server
    const { initSocket } = require('./services/socketService');
    initSocket(httpServer);

    // Initialize Supabase Realtime listeners
    const { supabaseAdmin } = require('./config/supabase');
    const { broadcastNewOrder } = require('./services/socketService');

    // Listen for new orders on Supabase Realtime — push to online drivers
    const ordersChannel = supabaseAdmin
      .channel('public:orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          fastify.log.info({ orderId: payload.new.id }, 'New order received — broadcasting to drivers');
          broadcastNewOrder(payload.new);
        }
      )
      .subscribe();

    const PORT = parseInt(process.env.PORT || '3000', 10);

    await fastify.listen({ port: PORT, host: '0.0.0.0' });

    console.log(`
╔════════════════════════════════════════════════╗
║   🚚 QC Driver Backend is running              ║
║   Port    : ${PORT}                             
║   Env     : ${process.env.NODE_ENV || 'development'}                      
║   Health  : http://localhost:${PORT}/health      
╚════════════════════════════════════════════════╝
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  fastify.log.info('SIGTERM received. Shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await fastify.close();
  process.exit(0);
});

start();
