// src/services/socketService.js
let io = null;

// Map of driverId => socket.id for targeted pushes
const driverSockets = new Map();

// ──────────────────────────────────────────────────────────────
// Initialize Socket.io with the HTTP server
// ──────────────────────────────────────────────────────────────
function initSocket(httpServer) {
  const { Server } = require('socket.io');

  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Driver registers their identity after connecting
    socket.on('driver:register', ({ driverId }) => {
      if (driverId) {
        driverSockets.set(driverId, socket.id);
        socket.join(`driver:${driverId}`);
        console.log(`[Socket] Driver ${driverId} registered with socket ${socket.id}`);
      }
    });

    // Driver goes online/offline
    socket.on('driver:status', ({ driverId, isOnline }) => {
      socket.broadcast.emit('driver:status_changed', { driverId, isOnline });
    });

    // Driver sends GPS ping during active trip
    socket.on('driver:gps_ping', ({ driverId, tripId, latitude, longitude }) => {
      // Broadcast to admin room and customer (future)
      io.to('admin').emit('gps:update', { driverId, tripId, latitude, longitude, timestamp: new Date() });
    });

    // Driver sends chat message
    socket.on('trip:chat_message', (data) => {
      io.to(`trip:${data.tripId}`).emit('trip:chat_message', data);
    });

    // Join a trip room (driver + customer)
    socket.on('trip:join', ({ tripId }) => {
      socket.join(`trip:${tripId}`);
    });

    socket.on('disconnect', () => {
      // Remove from map
      for (const [driverId, socketId] of driverSockets.entries()) {
        if (socketId === socket.id) {
          driverSockets.delete(driverId);
          break;
        }
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

// ──────────────────────────────────────────────────────────────
// Push a new order to a specific driver
// ──────────────────────────────────────────────────────────────
function pushOrderToDriver(driverId, order) {
  if (!io) return;
  io.to(`driver:${driverId}`).emit('order:new', order);
}

// ──────────────────────────────────────────────────────────────
// Broadcast a new order to ALL online drivers (fallback)
// ──────────────────────────────────────────────────────────────
function broadcastNewOrder(order) {
  if (!io) return;
  io.emit('order:new', order);
}

// ──────────────────────────────────────────────────────────────
// Notify driver of order status change
// ──────────────────────────────────────────────────────────────
function notifyOrderUpdate(driverId, tripId, status, data = {}) {
  if (!io) return;
  io.to(`driver:${driverId}`).emit('order:updated', { tripId, status, ...data });
}

// ──────────────────────────────────────────────────────────────
// Push notification to driver
// ──────────────────────────────────────────────────────────────
function pushNotification(driverId, notification) {
  if (!io) return;
  io.to(`driver:${driverId}`).emit('notification:new', notification);
}

function getIo() {
  return io;
}

module.exports = {
  initSocket,
  pushOrderToDriver,
  broadcastNewOrder,
  notifyOrderUpdate,
  pushNotification,
  getIo,
};
