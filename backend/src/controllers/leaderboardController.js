// src/controllers/leaderboardController.js
const { query } = require('../config/db');

// ──────────────────────────────────────────────────────────────
// GET /api/leaderboard
// ──────────────────────────────────────────────────────────────
async function getLeaderboard(request, reply) {
  const driverId = request.driver.id;

  const now        = new Date();
  const dayOfWeek  = now.getDay();
  const weekStart  = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartDate = weekStart.toISOString().split('T')[0];

  // Try cache
  const { rows: cached } = await query(
    `SELECT * FROM driver_leaderboard_cache WHERE week_start=$1 ORDER BY rank_position ASC LIMIT 20`,
    [weekStartDate]
  );

  if (cached.length > 0) {
    const myRank = cached.find((r) => r.driver_id === driverId) || null;
    return reply.send({ success: true, data: cached, myRank });
  }

  // Build live leaderboard
  const { rows: stats } = await query(
    `SELECT ds.driver_id, ds.weekly_earnings, ds.weekly_orders_completed,
            dp.full_name, dp.avatar_url
     FROM driver_stats ds
     LEFT JOIN driver_profiles dp ON dp.id = ds.driver_id
     ORDER BY ds.weekly_earnings DESC
     LIMIT 20`
  );

  const leaderboard = stats.map((s, index) => ({
    rank:           index + 1,
    driverId:       s.driver_id,
    fullName:       s.full_name || 'Unknown Driver',
    avatarUrl:      s.avatar_url || null,
    weeklyEarnings: parseFloat(s.weekly_earnings || 0),
    weeklyTrips:    s.weekly_orders_completed || 0,
    isMe:           s.driver_id === driverId,
  }));

  const myRank = leaderboard.find((r) => r.driverId === driverId) || null;
  return reply.send({ success: true, data: leaderboard, myRank });
}

// ──────────────────────────────────────────────────────────────
// GET /api/promos
// ──────────────────────────────────────────────────────────────
async function getPromoSlides(request, reply) {
  const { rows } = await query(
    `SELECT id, title, image_url, redirect_url, display_order, target_driver_type
     FROM driver_ads WHERE is_active=true ORDER BY display_order ASC`
  );
  return reply.send({ success: true, data: rows });
}

// ──────────────────────────────────────────────────────────────
// GET /api/trips/:tripId/chat
// ──────────────────────────────────────────────────────────────
async function getChatMessages(request, reply) {
  const { tripId } = request.params;
  const { rows }   = await query(
    `SELECT * FROM driver_chat_messages WHERE trip_id=$1 ORDER BY created_at ASC`,
    [tripId]
  );
  return reply.send({ success: true, data: rows });
}

// ──────────────────────────────────────────────────────────────
// POST /api/trips/:tripId/chat
// ──────────────────────────────────────────────────────────────
async function sendChatMessage(request, reply) {
  const driverId = request.driver.id;
  const { tripId } = request.params;
  const { message } = request.body;

  if (!message || !message.trim()) {
    return reply.code(400).send({ success: false, message: 'Message cannot be empty' });
  }

  const { rows } = await query(
    `INSERT INTO driver_chat_messages (trip_id, sender_type, sender_id, message, is_read)
     VALUES ($1,'driver',$2,$3,false) RETURNING *`,
    [tripId, driverId, message.trim()]
  );

  const { getIo } = require('../services/socketService');
  const io = getIo();
  if (io) io.to(`trip:${tripId}`).emit('trip:chat_message', rows[0]);

  return reply.send({ success: true, data: rows[0] });
}

// ──────────────────────────────────────────────────────────────
// GET /api/achievements
// ──────────────────────────────────────────────────────────────
async function getAchievements(request, reply) {
  const driverId = request.driver.id;

  const { rows } = await query(
    `SELECT weekly_orders_completed, total_orders_completed, rating
     FROM driver_stats WHERE driver_id=$1`,
    [driverId]
  );

  const stats       = rows[0] || {};
  const weeklyOrders = stats.weekly_orders_completed || 0;

  const ranks = [
    { id: 1, name: 'Trainee',               threshold: 0 },
    { id: 2, name: 'Second Officer',        threshold: 16 },
    { id: 3, name: 'Junior First Officer',  threshold: 18 },
    { id: 4, name: 'First Officer',         threshold: 20 },
    { id: 5, name: 'Captain',               threshold: 22 },
    { id: 6, name: 'Flight Captain',        threshold: 24 },
    { id: 7, name: 'Senior Flight Captain', threshold: 26 },
    { id: 8, name: 'Commercial Captain',    threshold: 30 },
  ];

  let currentRankIndex = ranks.findIndex((r) => weeklyOrders < r.threshold) - 1;
  if (currentRankIndex < 0) currentRankIndex = ranks.length - 1;

  const currentRank = ranks[currentRankIndex];
  const nextRank    = ranks[currentRankIndex + 1] || null;
  const isPilot     = weeklyOrders >= 50;

  return reply.send({
    success: true,
    data: {
      weeklyOrders,
      totalOrders:      stats.total_orders_completed || 0,
      rating:           parseFloat(stats.rating || 5.0),
      currentRank, nextRank, isPilot,
      pilotProgress:    Math.min(100, (weeklyOrders / 50) * 100),
      ordersToNextRank: nextRank ? Math.max(0, nextRank.threshold - weeklyOrders) : 0,
      ordersToPilot:    Math.max(0, 50 - weeklyOrders),
      allRanks:         ranks,
    },
  });
}

module.exports = { getLeaderboard, getPromoSlides, getChatMessages, sendChatMessage, getAchievements };
