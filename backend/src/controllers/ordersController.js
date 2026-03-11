// src/controllers/ordersController.js
const { query, withTransaction } = require('../config/db');
const { generateDeliveryOtp }    = require('../services/otpService');
const { uploadFile }             = require('../services/uploadService');
const { notifyOrderUpdate }      = require('../services/socketService');

// ──────────────────────────────────────────────────────────────
// GET /api/orders/available
// ──────────────────────────────────────────────────────────────
async function getAvailableOrders(request, reply) {
  const { rows: orders } = await query(
    `SELECT
       id, vendor_id, product_name, quantity, total_amount,
       customer_name, customer_phone, order_date, status,
       order_type, vehicle_type, pickup_address, pickup_latitude,
       pickup_longitude, delivery_address, delivery_latitude,
       delivery_longitude, vendor_shop_name, delivery_fee,
       model_id_requested, model_name_requested,
       weight_capacity_requested, body_type_requested, created_at
     FROM orders
     WHERE status = 'Pending' AND driver_id IS NULL
     ORDER BY created_at DESC
     LIMIT 20`
  );

  return reply.send({ success: true, data: orders });
}

// ──────────────────────────────────────────────────────────────
// GET /api/orders/active
// ──────────────────────────────────────────────────────────────
async function getActiveTrip(request, reply) {
  const driverId = request.driver.id;

  const { rows } = await query(
    `SELECT
       dt.*,
       o.id AS o_id, o.product_name, o.customer_name, o.customer_phone,
       o.pickup_address, o.delivery_address, o.delivery_latitude,
       o.delivery_longitude, o.vendor_shop_name, o.delivery_fee,
       o.total_amount, o.delivery_otp, o.items
     FROM delivery_trips dt
     LEFT JOIN orders o ON o.id = dt.order_id
     WHERE dt.driver_id = $1 AND dt.status IN ('accepted','picked_up')
     ORDER BY dt.started_at DESC
     LIMIT 1`,
    [driverId]
  );

  if (!rows.length) {
    return reply.send({ success: true, data: null });
  }

  const row  = rows[0];
  const trip = {
    ...row,
    orders: {
      id:               row.o_id,
      product_name:     row.product_name,
      customer_name:    row.customer_name,
      customer_phone:   row.customer_phone,
      pickup_address:   row.pickup_address,
      delivery_address: row.delivery_address,
      delivery_latitude:  row.delivery_latitude,
      delivery_longitude: row.delivery_longitude,
      vendor_shop_name: row.vendor_shop_name,
      delivery_fee:     row.delivery_fee,
      total_amount:     row.total_amount,
      delivery_otp:     row.delivery_otp,
      items:            row.items,
    },
  };

  return reply.send({ success: true, data: trip });
}

// ──────────────────────────────────────────────────────────────
// POST /api/orders/:orderId/accept
// ──────────────────────────────────────────────────────────────
async function acceptOrder(request, reply) {
  const driverId = request.driver.id;
  const { orderId } = request.params;

  // Check existing active trip
  const { rows: active } = await query(
    `SELECT id FROM delivery_trips WHERE driver_id=$1 AND status IN ('accepted','picked_up') LIMIT 1`,
    [driverId]
  );

  if (active.length) {
    return reply.code(409).send({
      success: false,
      message: 'You already have an active trip. Complete it before accepting another.',
    });
  }

  // Fetch order
  const { rows: orders } = await query(
    `SELECT * FROM orders WHERE id=$1 AND status='Pending' AND driver_id IS NULL`,
    [orderId]
  );

  if (!orders.length) {
    return reply.code(404).send({ success: false, message: 'Order not available or already taken' });
  }

  const order = orders[0];

  const { rows: profiles } = await query(
    `SELECT full_name, mobile_number FROM driver_profiles WHERE id=$1`,
    [driverId]
  );
  const profile = profiles[0] || {};

  const deliveryOtp = await generateDeliveryOtp(orderId);

  try {
    const trip = await withTransaction(async (client) => {
      // Update order
      await client.query(
        `UPDATE orders
         SET driver_id=$1, driver_name=$2, driver_number=$3, status='Assigned', delivery_otp=$4
         WHERE id=$5`,
        [driverId, profile.full_name || '', parseInt(profile.mobile_number || '0'), deliveryOtp, orderId]
      );

      // Create delivery_trip
      const { rows: tripRows } = await client.query(
        `INSERT INTO delivery_trips (order_id, driver_id, status, pickup_otp, payout_amount, started_at)
         VALUES ($1,$2,'accepted',$3,$4,NOW())
         RETURNING *`,
        [parseInt(orderId), driverId, deliveryOtp, order.delivery_fee || order.total_amount || 0]
      );

      return tripRows[0];
    });

    notifyOrderUpdate(driverId, trip.id, 'accepted', { orderId });

    return reply.send({
      success: true,
      message: 'Order accepted successfully',
      trip: { ...trip, order },
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, message: 'Failed to accept order' });
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/orders/:orderId/ignore
// ──────────────────────────────────────────────────────────────
async function ignoreOrder(request, reply) {
  return reply.send({ success: true, message: 'Order ignored', orderId: request.params.orderId });
}

// ──────────────────────────────────────────────────────────────
// POST /api/trips/:tripId/arrived-pickup
// ──────────────────────────────────────────────────────────────
async function arrivedAtPickup(request, reply) {
  const driverId  = request.driver.id;
  const { tripId } = request.params;

  const { rows } = await query(
    `SELECT * FROM delivery_trips WHERE id=$1 AND driver_id=$2`,
    [tripId, driverId]
  );

  if (!rows.length) return reply.code(404).send({ success: false, message: 'Trip not found' });
  if (rows[0].status !== 'accepted') {
    return reply.code(400).send({ success: false, message: `Cannot mark arrival. Current status: ${rows[0].status}` });
  }

  return reply.send({ success: true, message: 'Arrived at pickup. Please take a package photo to confirm.', requiresPhoto: true });
}

// ──────────────────────────────────────────────────────────────
// POST /api/trips/:tripId/confirm-pickup
// ──────────────────────────────────────────────────────────────
async function confirmPickup(request, reply) {
  const driverId  = request.driver.id;
  const { tripId } = request.params;

  try {
    const data = await request.file();
    if (!data) return reply.code(400).send({ success: false, message: 'Package photo is required' });

    const buffer = await data.toBuffer();
    const result = await uploadFile({
      bucket:   process.env.STORAGE_BUCKET_PACKAGE_PHOTOS || 'package-photos',
      folder:   `${tripId}/pickup`,
      filename: data.filename,
      buffer,
      mimetype: data.mimetype,
    });

    await query(
      `INSERT INTO driver_package_photos (trip_id, driver_id, photo_url, step) VALUES ($1,$2,$3,0)`,
      [tripId, driverId, result.path]
    );

    await query(
      `UPDATE delivery_trips SET status='picked_up' WHERE id=$1 AND driver_id=$2`,
      [tripId, driverId]
    );

    const { rows: tripRows } = await query(
      `SELECT order_id FROM delivery_trips WHERE id=$1`,
      [tripId]
    );

    if (tripRows[0]?.order_id) {
      await query(
        `UPDATE orders SET status='Out for Delivery' WHERE id=$1`,
        [tripRows[0].order_id]
      );
    }

    notifyOrderUpdate(driverId, tripId, 'picked_up');
    return reply.send({ success: true, message: 'Pickup confirmed. Navigate to delivery location.' });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/trips/:tripId/arrived-dropoff
// ──────────────────────────────────────────────────────────────
async function arrivedAtDropoff(request, reply) {
  const driverId  = request.driver.id;
  const { tripId } = request.params;

  const { rows } = await query(
    `SELECT dt.*, o.customer_phone, o.delivery_otp
     FROM delivery_trips dt
     LEFT JOIN orders o ON o.id = dt.order_id
     WHERE dt.id=$1 AND dt.driver_id=$2`,
    [tripId, driverId]
  );

  if (!rows.length) return reply.code(404).send({ success: false, message: 'Trip not found' });

  const trip = rows[0];
  console.log(`\n📦 [DELIVERY OTP] Order ${trip.order_id} | OTP: ${trip.delivery_otp}\n`);

  return reply.send({
    success: true,
    message: 'OTP sent to customer. Ask customer for the 4-digit PIN.',
    ...(process.env.OTP_PROVIDER === 'mock' && { otp_for_testing: trip.delivery_otp }),
  });
}

// ──────────────────────────────────────────────────────────────
// POST /api/trips/:tripId/complete
// ──────────────────────────────────────────────────────────────
async function completeDelivery(request, reply) {
  const driverId  = request.driver.id;
  const { tripId } = request.params;
  const { otp }    = request.body;

  if (!otp || otp.length !== 4) {
    return reply.code(400).send({ success: false, message: '4-digit OTP required' });
  }

  const { rows } = await query(
    `SELECT dt.*, o.id AS o_id, o.delivery_otp, o.total_amount, o.delivery_fee, o.customer_name
     FROM delivery_trips dt
     LEFT JOIN orders o ON o.id = dt.order_id
     WHERE dt.id=$1 AND dt.driver_id=$2`,
    [tripId, driverId]
  );

  if (!rows.length) return reply.code(404).send({ success: false, message: 'Trip not found' });

  const trip = rows[0];

  if (trip.status !== 'picked_up') {
    return reply.code(400).send({ success: false, message: `Trip is not in picked_up state. Current: ${trip.status}` });
  }

  if (trip.delivery_otp !== otp) {
    return reply.code(400).send({ success: false, message: 'Incorrect OTP. Please try again.' });
  }

  const payoutAmount = parseFloat(trip.payout_amount || trip.delivery_fee || trip.total_amount || 0);

  try {
    await withTransaction(async (client) => {
      // Mark trip delivered
      await client.query(
        `UPDATE delivery_trips SET status='delivered', completed_at=NOW() WHERE id=$1`,
        [tripId]
      );

      // Mark order delivered
      await client.query(
        `UPDATE orders SET status='Delivered' WHERE id=$1`,
        [trip.order_id]
      );

      // Update wallet
      const { rows: walletRows } = await client.query(
        `SELECT id, balance FROM driver_wallets WHERE driver_id=$1`,
        [driverId]
      );

      if (walletRows.length) {
        const wallet     = walletRows[0];
        const newBalance = parseFloat(wallet.balance || 0) + payoutAmount;

        await client.query(
          `UPDATE driver_wallets SET balance=$1, last_updated=NOW() WHERE driver_id=$2`,
          [newBalance, driverId]
        );

        await client.query(
          `INSERT INTO driver_transactions (wallet_id, amount, type, description)
           VALUES ($1,$2,'credit',$3)`,
          [wallet.id, payoutAmount, `Trip Earnings — Order #${trip.order_id}`]
        );
      }

      // Update driver stats
      await client.query(
        `UPDATE driver_stats
         SET total_earnings       = total_earnings + $1,
             weekly_earnings      = weekly_earnings + $1,
             total_orders_completed  = total_orders_completed + 1,
             weekly_orders_completed = weekly_orders_completed + 1
         WHERE driver_id = $2`,
        [payoutAmount, driverId]
      );

      // Push notification
      await client.query(
        `INSERT INTO driver_notifications (driver_id, title, message, type)
         VALUES ($1,'Delivery Completed! 🎉',$2,'success')`,
        [driverId, `₹${payoutAmount} has been added to your wallet.`]
      );
    });

    notifyOrderUpdate(driverId, tripId, 'delivered', { payout: payoutAmount });

    return reply.send({
      success: true,
      message: 'Delivery completed successfully!',
      payout:  payoutAmount,
      tripId,
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, message: 'Failed to complete delivery' });
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/trips/:tripId/cancel
// ──────────────────────────────────────────────────────────────
async function cancelTrip(request, reply) {
  const driverId  = request.driver.id;
  const { tripId } = request.params;
  const { reason } = request.body;

  if (!reason) return reply.code(400).send({ success: false, message: 'Cancellation reason is required' });

  const { rows } = await query(
    `SELECT order_id, status FROM delivery_trips WHERE id=$1 AND driver_id=$2`,
    [tripId, driverId]
  );

  if (!rows.length) return reply.code(404).send({ success: false, message: 'Trip not found' });

  const trip = rows[0];
  if (['delivered', 'cancelled'].includes(trip.status)) {
    return reply.code(400).send({ success: false, message: `Trip already ${trip.status}` });
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE delivery_trips SET status='cancelled', completed_at=NOW() WHERE id=$1`,
      [tripId]
    );
    await client.query(
      `UPDATE orders
       SET status='Pending', driver_id=NULL, driver_name=NULL, driver_number=NULL, delivery_otp=NULL
       WHERE id=$1`,
      [trip.order_id]
    );
  });

  notifyOrderUpdate(driverId, tripId, 'cancelled', { reason });
  return reply.send({ success: true, message: 'Trip cancelled', reason });
}

// ──────────────────────────────────────────────────────────────
// GET /api/orders/history
// ──────────────────────────────────────────────────────────────
async function getOrderHistory(request, reply) {
  const driverId = request.driver.id;
  const { status = 'Completed', page = 1, limit = 20 } = request.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const statusMap = { Completed: 'delivered', Cancelled: 'cancelled', Missed: 'pending' };
  const dbStatus  = statusMap[status] || 'delivered';

  const { rows: trips } = await query(
    `SELECT
       dt.id, dt.status, dt.payout_amount, dt.distance_text, dt.started_at, dt.completed_at,
       o.id AS o_id, o.product_name, o.customer_name, o.pickup_address,
       o.delivery_address, o.total_amount, o.order_date
     FROM delivery_trips dt
     LEFT JOIN orders o ON o.id = dt.order_id
     WHERE dt.driver_id=$1 AND dt.status=$2
     ORDER BY dt.completed_at DESC
     LIMIT $3 OFFSET $4`,
    [driverId, dbStatus, parseInt(limit), offset]
  );

  const { rows: countRows } = await query(
    `SELECT COUNT(*) FROM delivery_trips WHERE driver_id=$1 AND status=$2`,
    [driverId, dbStatus]
  );

  const total = parseInt(countRows[0].count);

  const formatted = trips.map((t) => ({
    ...t,
    orders: {
      id:               t.o_id,
      product_name:     t.product_name,
      customer_name:    t.customer_name,
      pickup_address:   t.pickup_address,
      delivery_address: t.delivery_address,
      total_amount:     t.total_amount,
      order_date:       t.order_date,
    },
  }));

  return reply.send({
    success: true,
    data: formatted,
    pagination: {
      page:       parseInt(page),
      limit:      parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
}

module.exports = {
  getAvailableOrders, getActiveTrip, acceptOrder, ignoreOrder,
  arrivedAtPickup, confirmPickup, arrivedAtDropoff,
  completeDelivery, cancelTrip, getOrderHistory,
};
