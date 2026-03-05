// src/controllers/earningsController.js
const { supabaseAdmin } = require('../config/supabase');

// ──────────────────────────────────────────────────────────────
// GET /api/earnings
// Query: ?timeframe=daily|weekly|monthly&date=YYYY-MM-DD
//        &startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (for custom)
// ──────────────────────────────────────────────────────────────
async function getEarnings(request, reply) {
  const driverId = request.driver.id;
  const { timeframe = 'daily', date, startDate, endDate } = request.query;

  let rangeStart, rangeEnd;
  const now = new Date();

  if (timeframe === 'daily') {
    const targetDate = date ? new Date(date) : now;
    rangeStart = new Date(targetDate);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(targetDate);
    rangeEnd.setHours(23, 59, 59, 999);
  } else if (timeframe === 'weekly') {
    const targetDate = date ? new Date(date) : now;
    const dayOfWeek = targetDate.getDay();
    rangeStart = new Date(targetDate);
    rangeStart.setDate(targetDate.getDate() - dayOfWeek + 1); // Monday
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeStart.getDate() + 6); // Sunday
    rangeEnd.setHours(23, 59, 59, 999);
  } else if (timeframe === 'monthly') {
    const targetDate = date ? new Date(date) : now;
    rangeStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    rangeEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    rangeEnd.setHours(23, 59, 59, 999);
  } else if (timeframe === 'custom') {
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, message: 'startDate and endDate required for custom timeframe' });
    }
    rangeStart = new Date(startDate);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(endDate);
    rangeEnd.setHours(23, 59, 59, 999);
  } else {
    return reply.code(400).send({ success: false, message: 'Invalid timeframe. Use: daily, weekly, monthly, custom' });
  }

  // Fetch completed trips in range
  const { data: trips, error } = await supabaseAdmin
    .from('delivery_trips')
    .select(`
      id, payout_amount, completed_at, status,
      orders (id, product_name, order_type, customer_name)
    `)
    .eq('driver_id', driverId)
    .eq('status', 'delivered')
    .gte('completed_at', rangeStart.toISOString())
    .lte('completed_at', rangeEnd.toISOString())
    .order('completed_at', { ascending: false });

  if (error) {
    return reply.code(500).send({ success: false, message: 'Failed to fetch earnings' });
  }

  const totalAmount = (trips || []).reduce((sum, t) => sum + parseFloat(t.payout_amount || 0), 0);
  const tripCount = trips?.length || 0;
  const avgPerTrip = tripCount > 0 ? Math.round(totalAmount / tripCount) : 0;

  // Format for frontend
  const formattedTrips = (trips || []).map((t) => ({
    id: t.id,
    type: t.orders?.product_name || 'Delivery',
    amount: parseFloat(t.payout_amount || 0),
    date: formatDisplayDate(t.completed_at, timeframe),
    orderId: t.orders?.id,
    customerName: t.orders?.customer_name,
  }));

  return reply.send({
    success: true,
    data: {
      timeframe,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      totalAmount,
      tripCount,
      avgPerTrip,
      trips: formattedTrips,
    },
  });
}

// ──────────────────────────────────────────────────────────────
// GET /api/earnings/summary
// Quick summary: today / this week / this month / total
// ──────────────────────────────────────────────────────────────
async function getEarningsSummary(request, reply) {
  const driverId = request.driver.id;

  const { data: stats, error } = await supabaseAdmin
    .from('driver_stats')
    .select('total_earnings, weekly_earnings, total_orders_completed, weekly_orders_completed, wallet_balance, rating')
    .eq('driver_id', driverId)
    .single();

  if (error) {
    return reply.code(500).send({ success: false, message: 'Failed to fetch summary' });
  }

  // Today's earnings — from trips
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayTrips } = await supabaseAdmin
    .from('delivery_trips')
    .select('payout_amount')
    .eq('driver_id', driverId)
    .eq('status', 'delivered')
    .gte('completed_at', todayStart.toISOString());

  const todayEarnings = (todayTrips || []).reduce((sum, t) => sum + parseFloat(t.payout_amount || 0), 0);
  const todayOrders = todayTrips?.length || 0;

  return reply.send({
    success: true,
    data: {
      today: { earnings: todayEarnings, orders: todayOrders },
      weekly: {
        earnings: parseFloat(stats?.weekly_earnings || 0),
        orders: stats?.weekly_orders_completed || 0,
      },
      total: {
        earnings: parseFloat(stats?.total_earnings || 0),
        orders: stats?.total_orders_completed || 0,
      },
      rating: parseFloat(stats?.rating || 5.0),
    },
  });
}

// ──────────────────────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────────────────────
function formatDisplayDate(isoString, timeframe) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();

  if (isToday) {
    return `Today, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

module.exports = { getEarnings, getEarningsSummary };
