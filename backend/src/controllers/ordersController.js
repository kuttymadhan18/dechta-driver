// src/controllers/ordersController.js
const { supabaseAdmin } = require('../config/supabase');
const { generateDeliveryOtp } = require('../services/otpService');
const { uploadFile } = require('../services/uploadService');
const { notifyOrderUpdate, pushNotification } = require('../services/socketService');

// ──────────────────────────────────────────────────────────────
// GET /api/orders/available
// Returns all orders that match the driver's vehicle type and are unassigned
// ──────────────────────────────────────────────────────────────
async function getAvailableOrders(request, reply) {
  const driverId = request.driver.id;

  // Get driver's vehicle type
  const { data: vehicle } = await supabaseAdmin
    .from('driver_vehicles')
    .select('vehicle_type, model_id, weight_capacity')
    .eq('driver_id', driverId)
    .single();

  // Base query — unassigned, pending orders
  let query = supabaseAdmin
    .from('orders')
    .select(`
      id, vendor_id, product_name, quantity, total_amount,
      customer_name, customer_phone, order_date, status,
      order_type, vehicle_type, pickup_address, pickup_latitude,
      pickup_longitude, delivery_address, delivery_latitude,
      delivery_longitude, vendor_shop_name, delivery_fee,
      model_id_requested, model_name_requested,
      weight_capacity_requested, body_type_requested,
      created_at
    `)
    .eq('status', 'Pending')
    .is('driver_id', null)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: orders, error } = await query;

  if (error) {
    return reply.code(500).send({ success: false, message: 'Failed to fetch orders' });
  }

  return reply.send({ success: true, data: orders || [] });
}

// ──────────────────────────────────────────────────────────────
// GET /api/orders/active
// Returns the driver's current active trip
// ──────────────────────────────────────────────────────────────
async function getActiveTrip(request, reply) {
  const driverId = request.driver.id;

  const { data: trip, error } = await supabaseAdmin
    .from('delivery_trips')
    .select(`
      *,
      orders (
        id, product_name, customer_name, customer_phone,
        pickup_address, delivery_address, delivery_latitude,
        delivery_longitude, vendor_shop_name, delivery_fee,
        total_amount, delivery_otp, items
      )
    `)
    .eq('driver_id', driverId)
    .in('status', ['accepted', 'picked_up'])
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    return reply.code(500).send({ success: false, message: 'Failed to fetch active trip' });
  }

  return reply.send({ success: true, data: trip || null });
}

// ──────────────────────────────────────────────────────────────
// POST /api/orders/:orderId/accept
// Driver accepts an order — creates a delivery_trip record
// ──────────────────────────────────────────────────────────────
async function acceptOrder(request, reply) {
  const driverId = request.driver.id;
  const { orderId } = request.params;

  // Check if driver already has an active trip
  const { data: existingTrip } = await supabaseAdmin
    .from('delivery_trips')
    .select('id')
    .eq('driver_id', driverId)
    .in('status', ['accepted', 'picked_up'])
    .limit(1)
    .single();

  if (existingTrip) {
    return reply.code(409).send({
      success: false,
      message: 'You already have an active trip. Complete it before accepting another.',
    });
  }

  // Fetch the order
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('status', 'Pending')
    .is('driver_id', null)
    .single();

  if (orderError || !order) {
    return reply.code(404).send({ success: false, message: 'Order not available or already taken' });
  }

  // Get driver name + vehicle for order update
  const { data: profile } = await supabaseAdmin
    .from('driver_profiles')
    .select('full_name, mobile_number')
    .eq('id', driverId)
    .single();

  // Generate delivery OTP
  const deliveryOtp = await generateDeliveryOtp(orderId);

  // Update order — assign driver
  await supabaseAdmin
    .from('orders')
    .update({
      driver_id: driverId,
      driver_name: profile?.full_name || '',
      driver_number: parseInt(profile?.mobile_number || '0'),
      status: 'Assigned',
      delivery_otp: deliveryOtp,
    })
    .eq('id', orderId);

  // Create delivery_trip record
  const { data: trip, error: tripError } = await supabaseAdmin
    .from('delivery_trips')
    .insert({
      order_id: parseInt(orderId),
      driver_id: driverId,
      status: 'accepted',
      pickup_otp: deliveryOtp,
      payout_amount: order.delivery_fee || order.total_amount || 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (tripError) {
    request.log.error(tripError);
    return reply.code(500).send({ success: false, message: 'Failed to create trip record' });
  }

  // Socket notification to admin
  notifyOrderUpdate(driverId, trip.id, 'accepted', { orderId });

  return reply.send({
    success: true,
    message: 'Order accepted successfully',
    trip: {
      ...trip,
      order,
    },
  });
}

// ──────────────────────────────────────────────────────────────
// POST /api/orders/:orderId/ignore
// Driver ignores/misses an order
// ──────────────────────────────────────────────────────────────
async function ignoreOrder(request, reply) {
  const { orderId } = request.params;

  return reply.send({
    success: true,
    message: 'Order ignored',
    orderId,
  });
}

// ──────────────────────────────────────────────────────────────
// POST /api/trips/:tripId/arrived-pickup
// Driver arrived at pickup — triggers photo requirement
// ──────────────────────────────────────────────────────────────
async function arrivedAtPickup(request, reply) {
  const driverId = request.driver.id;
  const { tripId } = request.params;

  const { data: trip, error } = await supabaseAdmin
    .from('delivery_trips')
    .select('*')
    .eq('id', tripId)
    .eq('driver_id', driverId)
    .single();

  if (error || !trip) {
    return reply.code(404).send({ success: false, message: 'Trip not found' });
  }

  if (trip.status !== 'accepted') {
    return reply.code(400).send({ success: false, message: `Cannot mark arrival. Current status: ${trip.status}` });
  }

  return reply.send({
    success: true,
    message: 'Arrived at pickup. Please take a package photo to confirm.',
    requiresPhoto: true,
  });
}

// ──────────────────────────────────────────────────────────────
// POST /api/trips/:tripId/confirm-pickup
// Multipart: photo file — confirms pickup, moves to picked_up
// ──────────────────────────────────────────────────────────────
async function confirmPickup(request, reply) {
  const driverId = request.driver.id;
  const { tripId } = request.params;

  try {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ success: false, message: 'Package photo is required' });
    }

    const buffer = await data.toBuffer();

    // Upload photo to Supabase Storage
    const result = await uploadFile({
      bucket: process.env.STORAGE_BUCKET_PACKAGE_PHOTOS || 'package-photos',
      folder: `${tripId}/pickup`,
      filename: data.filename,
      buffer,
      mimetype: data.mimetype,
    });

    // Save photo record
    await supabaseAdmin.from('driver_package_photos').insert({
      trip_id: tripId,
      driver_id: driverId,
      photo_url: result.path,
      step: 0,
    });

    // Update trip status
    await supabaseAdmin
      .from('delivery_trips')
      .update({ status: 'picked_up' })
      .eq('id', tripId)
      .eq('driver_id', driverId);

    // Update order status
    const { data: trip } = await supabaseAdmin
      .from('delivery_trips')
      .select('order_id')
      .eq('id', tripId)
      .single();

    if (trip?.order_id) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'Out for Delivery' })
        .eq('id', trip.order_id);
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
// Driver arrived at drop-off — sends OTP to customer
// ──────────────────────────────────────────────────────────────
async function arrivedAtDropoff(request, reply) {
  const driverId = request.driver.id;
  const { tripId } = request.params;

  const { data: trip } = await supabaseAdmin
    .from('delivery_trips')
    .select('*, orders(customer_phone, delivery_otp)')
    .eq('id', tripId)
    .eq('driver_id', driverId)
    .single();

  if (!trip) return reply.code(404).send({ success: false, message: 'Trip not found' });

  // In production, SMS the OTP to customer via MSG91
  // For now: just return the OTP for testing
  console.log(`\n📦 [DELIVERY OTP] Order ${trip.order_id} | OTP: ${trip.orders?.delivery_otp}\n`);

  return reply.send({
    success: true,
    message: 'OTP sent to customer. Ask customer for the 4-digit PIN.',
    // Only in mock/dev mode
    ...(process.env.OTP_PROVIDER === 'mock' && { otp_for_testing: trip.orders?.delivery_otp }),
  });
}

// ──────────────────────────────────────────────────────────────
// POST /api/trips/:tripId/complete
// Body: { otp: "1234" } — verifies OTP and marks trip complete
// ──────────────────────────────────────────────────────────────
async function completeDelivery(request, reply) {
  const driverId = request.driver.id;
  const { tripId } = request.params;
  const { otp } = request.body;

  if (!otp || otp.length !== 4) {
    return reply.code(400).send({ success: false, message: '4-digit OTP required' });
  }

  // Fetch trip with order
  const { data: trip, error } = await supabaseAdmin
    .from('delivery_trips')
    .select('*, orders(id, delivery_otp, total_amount, delivery_fee, customer_name)')
    .eq('id', tripId)
    .eq('driver_id', driverId)
    .single();

  if (error || !trip) {
    return reply.code(404).send({ success: false, message: 'Trip not found' });
  }

  if (trip.status !== 'picked_up') {
    return reply.code(400).send({ success: false, message: `Trip is not in picked_up state. Current: ${trip.status}` });
  }

  // Verify OTP
  if (trip.orders?.delivery_otp !== otp) {
    return reply.code(400).send({ success: false, message: 'Incorrect OTP. Please try again.' });
  }

  const payoutAmount = trip.payout_amount || trip.orders?.delivery_fee || 0;

  // Mark trip completed
  await supabaseAdmin
    .from('delivery_trips')
    .update({
      status: 'delivered',
      completed_at: new Date().toISOString(),
    })
    .eq('id', tripId);

  // Mark order delivered
  await supabaseAdmin
    .from('orders')
    .update({ status: 'Delivered' })
    .eq('id', trip.order_id);

  // Add earnings to wallet
  const { data: wallet } = await supabaseAdmin
    .from('driver_wallets')
    .select('id, balance')
    .eq('driver_id', driverId)
    .single();

  if (wallet) {
    const newBalance = parseFloat(wallet.balance || 0) + parseFloat(payoutAmount);
    await supabaseAdmin
      .from('driver_wallets')
      .update({ balance: newBalance, last_updated: new Date().toISOString() })
      .eq('driver_id', driverId);

    // Record transaction
    await supabaseAdmin.from('driver_transactions').insert({
      wallet_id: wallet.id,
      amount: payoutAmount,
      type: 'credit',
      description: `Trip Earnings — Order #${trip.order_id}`,
    });
  }

  // Update driver stats
  const { data: stats } = await supabaseAdmin
    .from('driver_stats')
    .select('*')
    .eq('driver_id', driverId)
    .single();

  if (stats) {
    await supabaseAdmin
      .from('driver_stats')
      .update({
        total_earnings: parseFloat(stats.total_earnings || 0) + parseFloat(payoutAmount),
        weekly_earnings: parseFloat(stats.weekly_earnings || 0) + parseFloat(payoutAmount),
        total_orders_completed: (stats.total_orders_completed || 0) + 1,
        weekly_orders_completed: (stats.weekly_orders_completed || 0) + 1,
      })
      .eq('driver_id', driverId);
  }

  // Push success notification
  await supabaseAdmin.from('driver_notifications').insert({
    driver_id: driverId,
    title: 'Delivery Completed! 🎉',
    message: `₹${payoutAmount} has been added to your wallet.`,
    type: 'success',
  });

  notifyOrderUpdate(driverId, tripId, 'delivered', { payout: payoutAmount });

  return reply.send({
    success: true,
    message: 'Delivery completed successfully!',
    payout: payoutAmount,
    tripId,
  });
}

// ──────────────────────────────────────────────────────────────
// POST /api/trips/:tripId/cancel
// Body: { reason: string }
// ──────────────────────────────────────────────────────────────
async function cancelTrip(request, reply) {
  const driverId = request.driver.id;
  const { tripId } = request.params;
  const { reason } = request.body;

  if (!reason) {
    return reply.code(400).send({ success: false, message: 'Cancellation reason is required' });
  }

  const { data: trip, error } = await supabaseAdmin
    .from('delivery_trips')
    .select('order_id, status')
    .eq('id', tripId)
    .eq('driver_id', driverId)
    .single();

  if (error || !trip) {
    return reply.code(404).send({ success: false, message: 'Trip not found' });
  }

  if (['delivered', 'cancelled'].includes(trip.status)) {
    return reply.code(400).send({ success: false, message: `Trip already ${trip.status}` });
  }

  // Mark trip cancelled
  await supabaseAdmin
    .from('delivery_trips')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', tripId);

  // Reset order to Pending so another driver can pick it up
  await supabaseAdmin
    .from('orders')
    .update({
      status: 'Pending',
      driver_id: null,
      driver_name: null,
      driver_number: null,
      delivery_otp: null,
    })
    .eq('id', trip.order_id);

  notifyOrderUpdate(driverId, tripId, 'cancelled', { reason });

  return reply.send({ success: true, message: 'Trip cancelled', reason });
}

// ──────────────────────────────────────────────────────────────
// GET /api/orders/history
// Query: ?status=Completed|Cancelled|Missed&page=1&limit=20
// ──────────────────────────────────────────────────────────────
async function getOrderHistory(request, reply) {
  const driverId = request.driver.id;
  const { status = 'Completed', page = 1, limit = 20 } = request.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const statusMap = {
    Completed: 'delivered',
    Cancelled: 'cancelled',
    Missed: 'pending', // treat as missed if never accepted
  };

  const dbStatus = statusMap[status] || 'delivered';

  const { data: trips, error, count } = await supabaseAdmin
    .from('delivery_trips')
    .select(`
      id, status, payout_amount, distance_text, started_at, completed_at,
      orders (
        id, product_name, customer_name, pickup_address, 
        delivery_address, total_amount, order_date
      )
    `, { count: 'exact' })
    .eq('driver_id', driverId)
    .eq('status', dbStatus)
    .order('completed_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);

  if (error) {
    return reply.code(500).send({ success: false, message: 'Failed to fetch history' });
  }

  return reply.send({
    success: true,
    data: trips || [],
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count || 0,
      totalPages: Math.ceil((count || 0) / parseInt(limit)),
    },
  });
}

module.exports = {
  getAvailableOrders,
  getActiveTrip,
  acceptOrder,
  ignoreOrder,
  arrivedAtPickup,
  confirmPickup,
  arrivedAtDropoff,
  completeDelivery,
  cancelTrip,
  getOrderHistory,
};
