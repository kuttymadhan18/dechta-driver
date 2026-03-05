// src/controllers/leaderboardController.js
const { supabaseAdmin } = require('../config/supabase');

// ──────────────────────────────────────────────────────────────
// GET /api/leaderboard
// Returns weekly leaderboard; highlights current driver's rank
// ──────────────────────────────────────────────────────────────
async function getLeaderboard(request, reply) {
  const driverId = request.driver.id;

  // Get start of current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek + 1);
  weekStart.setHours(0, 0, 0, 0);

  // Try cache first
  const weekStartDate = weekStart.toISOString().split('T')[0];

  const { data: cached } = await supabaseAdmin
    .from('driver_leaderboard_cache')
    .select('*')
    .eq('week_start', weekStartDate)
    .order('rank_position', { ascending: true })
    .limit(20);

  if (cached && cached.length > 0) {
    const myRank = cached.find((r) => r.driver_id === driverId);
    return reply.send({ success: true, data: cached, myRank: myRank || null });
  }

  // Build live leaderboard from driver_stats
  const { data: stats, error } = await supabaseAdmin
    .from('driver_stats')
    .select(`
      driver_id, weekly_earnings, weekly_orders_completed,
      driver_profiles (full_name, avatar_url)
    `)
    .order('weekly_earnings', { ascending: false })
    .limit(20);

  if (error) {
    return reply.code(500).send({ success: false, message: 'Failed to fetch leaderboard' });
  }

  const leaderboard = (stats || []).map((s, index) => ({
    rank: index + 1,
    driverId: s.driver_id,
    fullName: s.driver_profiles?.full_name || 'Unknown Driver',
    avatarUrl: s.driver_profiles?.avatar_url || null,
    weeklyEarnings: parseFloat(s.weekly_earnings || 0),
    weeklyTrips: s.weekly_orders_completed || 0,
    isMe: s.driver_id === driverId,
  }));

  const myRank = leaderboard.find((r) => r.driverId === driverId) || null;

  return reply.send({ success: true, data: leaderboard, myRank });
}

// ──────────────────────────────────────────────────────────────
// GET /api/promos
// Returns active promo slides for home screen
// ──────────────────────────────────────────────────────────────
async function getPromoSlides(request, reply) {
  const { data, error } = await supabaseAdmin
    .from('driver_ads')
    .select('id, title, image_url, redirect_url, display_order, target_driver_type')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    return reply.code(500).send({ success: false, message: 'Failed to fetch promos' });
  }

  return reply.send({ success: true, data: data || [] });
}

// ──────────────────────────────────────────────────────────────
// GET /api/trips/:tripId/chat
// ──────────────────────────────────────────────────────────────
async function getChatMessages(request, reply) {
  const { tripId } = request.params;

  const { data, error } = await supabaseAdmin
    .from('driver_chat_messages')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) {
    return reply.code(500).send({ success: false, message: 'Failed to fetch messages' });
  }

  return reply.send({ success: true, data: data || [] });
}

// ──────────────────────────────────────────────────────────────
// POST /api/trips/:tripId/chat
// Body: { message: "..." }
// ──────────────────────────────────────────────────────────────
async function sendChatMessage(request, reply) {
  const driverId = request.driver.id;
  const { tripId } = request.params;
  const { message } = request.body;

  if (!message || !message.trim()) {
    return reply.code(400).send({ success: false, message: 'Message cannot be empty' });
  }

  const { data, error } = await supabaseAdmin
    .from('driver_chat_messages')
    .insert({
      trip_id: tripId,
      sender_type: 'driver',
      sender_id: driverId,
      message: message.trim(),
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    return reply.code(500).send({ success: false, message: 'Failed to send message' });
  }

  // Broadcast via Socket.io
  const { getIo } = require('../services/socketService');
  const io = getIo();
  if (io) {
    io.to(`trip:${tripId}`).emit('trip:chat_message', data);
  }

  return reply.send({ success: true, data });
}

// ──────────────────────────────────────────────────────────────
// GET /api/driver/achievements
// Returns driver rank info and progression
// ──────────────────────────────────────────────────────────────
async function getAchievements(request, reply) {
  const driverId = request.driver.id;

  const { data: stats } = await supabaseAdmin
    .from('driver_stats')
    .select('weekly_orders_completed, total_orders_completed, rating')
    .eq('driver_id', driverId)
    .single();

  const weeklyOrders = stats?.weekly_orders_completed || 0;

  const ranks = [
    { id: 1, name: 'Trainee', threshold: 0 },
    { id: 2, name: 'Second Officer', threshold: 16 },
    { id: 3, name: 'Junior First Officer', threshold: 18 },
    { id: 4, name: 'First Officer', threshold: 20 },
    { id: 5, name: 'Captain', threshold: 22 },
    { id: 6, name: 'Flight Captain', threshold: 24 },
    { id: 7, name: 'Senior Flight Captain', threshold: 26 },
    { id: 8, name: 'Commercial Captain', threshold: 30 },
  ];

  let currentRankIndex = ranks.findIndex((r) => weeklyOrders < r.threshold) - 1;
  if (currentRankIndex < 0) currentRankIndex = ranks.length - 1;

  const currentRank = ranks[currentRankIndex];
  const nextRank = ranks[currentRankIndex + 1] || null;
  const isPilot = weeklyOrders >= 50;

  return reply.send({
    success: true,
    data: {
      weeklyOrders,
      totalOrders: stats?.total_orders_completed || 0,
      rating: parseFloat(stats?.rating || 5.0),
      currentRank,
      nextRank,
      isPilot,
      pilotProgress: Math.min(100, (weeklyOrders / 50) * 100),
      ordersToNextRank: nextRank ? Math.max(0, nextRank.threshold - weeklyOrders) : 0,
      ordersToPilot: Math.max(0, 50 - weeklyOrders),
      allRanks: ranks,
    },
  });
}

module.exports = {
  getLeaderboard,
  getPromoSlides,
  getChatMessages,
  sendChatMessage,
  getAchievements,
};
