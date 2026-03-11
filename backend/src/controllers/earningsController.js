// src/controllers/earningsController.js
const { query } = require('../config/db');

function formatDisplayDate(isoString, timeframe) {
  if (!isoString) return '';
  const d     = new Date(isoString);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return `Today, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ──────────────────────────────────────────────────────────────
// GET /api/earnings
// ──────────────────────────────────────────────────────────────
async function getEarnings(request, reply) {
  const driverId = request.driver.id;
  const { timeframe = 'daily', date, startDate, endDate } = request.query;

  let rangeStart, rangeEnd;
  const now = new Date();

  if (timeframe === 'daily') {
    const d  = date ? new Date(date) : now;
    rangeStart = new Date(d); rangeStart.setHours(0, 0, 0, 0);
    rangeEnd   = new Date(d); rangeEnd.setHours(23, 59, 59, 999);
  } else if (timeframe === 'weekly') {
    const d    = date ? new Date(date) : now;
    const dow  = d.getDay();
    rangeStart = new Date(d); rangeStart.setDate(d.getDate() - dow + 1); rangeStart.setHours(0, 0, 0, 0);
    rangeEnd   = new Date(rangeStart); rangeEnd.setDate(rangeStart.getDate() + 6); rangeEnd.setHours(23, 59, 59, 999);
  } else if (timeframe === 'monthly') {
    const d    = date ? new Date(date) : now;
    rangeStart = new Date(d.getFullYear(), d.getMonth(), 1);
    rangeEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0); rangeEnd.setHours(23, 59, 59, 999);
  } else if (timeframe === 'custom') {
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, message: 'startDate and endDate required for custom timeframe' });
    }
    rangeStart = new Date(startDate); rangeStart.setHours(0, 0, 0, 0);
    rangeEnd   = new Date(endDate);   rangeEnd.setHours(23, 59, 59, 999);
  } else {
    return reply.code(400).send({ success: false, message: 'Invalid timeframe. Use: daily, weekly, monthly, custom' });
  }

  const { rows: trips } = await query(
    `SELECT dt.id, dt.payout_amount, dt.completed_at, dt.status,
            o.id AS o_id, o.product_name, o.order_type, o.customer_name
     FROM delivery_trips dt
     LEFT JOIN orders o ON o.id = dt.order_id
     WHERE dt.driver_id=$1 AND dt.status='delivered'
       AND dt.completed_at >= $2 AND dt.completed_at <= $3
     ORDER BY dt.completed_at DESC`,
    [driverId, rangeStart.toISOString(), rangeEnd.toISOString()]
  );

  const totalAmount = trips.reduce((sum, t) => sum + parseFloat(t.payout_amount || 0), 0);
  const tripCount   = trips.length;
  const avgPerTrip  = tripCount > 0 ? Math.round(totalAmount / tripCount) : 0;

  return reply.send({
    success: true,
    data: {
      timeframe, rangeStart: rangeStart.toISOString(), rangeEnd: rangeEnd.toISOString(),
      totalAmount, tripCount, avgPerTrip,
      trips: trips.map((t) => ({
        id:           t.id,
        type:         t.product_name || 'Delivery',
        amount:       parseFloat(t.payout_amount || 0),
        date:         formatDisplayDate(t.completed_at, timeframe),
        orderId:      t.o_id,
        customerName: t.customer_name,
      })),
    },
  });
}

// ──────────────────────────────────────────────────────────────
// GET /api/earnings/summary
// ──────────────────────────────────────────────────────────────
async function getEarningsSummary(request, reply) {
  const driverId   = request.driver.id;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [statsRes, todayRes] = await Promise.all([
    query(
      `SELECT total_earnings, weekly_earnings, total_orders_completed, weekly_orders_completed, rating
       FROM driver_stats WHERE driver_id=$1`,
      [driverId]
    ),
    query(
      `SELECT payout_amount FROM delivery_trips
       WHERE driver_id=$1 AND status='delivered' AND completed_at >= $2`,
      [driverId, todayStart.toISOString()]
    ),
  ]);

  const stats        = statsRes.rows[0] || {};
  const todayEarnings = todayRes.rows.reduce((sum, t) => sum + parseFloat(t.payout_amount || 0), 0);
  const todayOrders   = todayRes.rows.length;

  return reply.send({
    success: true,
    data: {
      today:  { earnings: todayEarnings, orders: todayOrders },
      weekly: { earnings: parseFloat(stats.weekly_earnings || 0), orders: stats.weekly_orders_completed || 0 },
      total:  { earnings: parseFloat(stats.total_earnings || 0),  orders: stats.total_orders_completed || 0 },
      rating: parseFloat(stats.rating || 5.0),
    },
  });
}

module.exports = { getEarnings, getEarningsSummary };
