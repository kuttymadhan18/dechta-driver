// src/controllers/driverController.js
const { supabaseAdmin } = require('../config/supabase');
const { uploadFile } = require('../services/uploadService');
const { pushNotification } = require('../services/socketService');

// ──────────────────────────────────────────────────────────────
// GET /api/driver/profile
// ──────────────────────────────────────────────────────────────
async function getProfile(request, reply) {
  const driverId = request.driver.id;

  const { data: profile, error } = await supabaseAdmin
    .from('driver_profiles')
    .select('*')
    .eq('id', driverId)
    .single();

  if (error || !profile) {
    return reply.code(404).send({ success: false, message: 'Profile not found' });
  }

  // Fetch stats
  const { data: stats } = await supabaseAdmin
    .from('driver_stats')
    .select('*')
    .eq('driver_id', driverId)
    .single();

  // Fetch vehicle
  const { data: vehicle } = await supabaseAdmin
    .from('driver_vehicles')
    .select('*')
    .eq('driver_id', driverId)
    .single();

  // Fetch bank
  const { data: bank } = await supabaseAdmin
    .from('driver_bank_accounts')
    .select('*')
    .eq('driver_id', driverId)
    .single();

  // Fetch documents
  const { data: docs } = await supabaseAdmin
    .from('driver_documentss')
    .select('*')
    .eq('driver_id', driverId)
    .single();

  // Fetch wallet
  const { data: wallet } = await supabaseAdmin
    .from('driver_wallets')
    .select('balance, outstanding_dues')
    .eq('driver_id', driverId)
    .single();

  return reply.send({
    success: true,
    data: {
      profile,
      stats: stats || {},
      vehicle: vehicle || null,
      bank: bank || null,
      documents: docs || null,
      wallet: wallet || { balance: 0, outstanding_dues: 0 },
    },
  });
}

// ──────────────────────────────────────────────────────────────
// PUT /api/driver/profile
// Update personal details
// ──────────────────────────────────────────────────────────────
async function updateProfile(request, reply) {
  const driverId = request.driver.id;
  const {
    fullName, dob, bloodGroup, tshirtSize,
    preferredZone, emergencyContact,
  } = request.body;

  const updates = {};
  if (fullName)       updates.full_name = fullName;
  if (dob)            updates.dob = dob;
  if (bloodGroup)     updates.blood_group = bloodGroup;
  if (tshirtSize)     updates.tshirt_size = tshirtSize;
  if (preferredZone)  updates.preferred_zone = preferredZone;
  if (emergencyContact) updates.emergency_contact = emergencyContact;

  const { data, error } = await supabaseAdmin
    .from('driver_profiles')
    .update(updates)
    .eq('id', driverId)
    .select()
    .single();

  if (error) {
    return reply.code(500).send({ success: false, message: 'Failed to update profile' });
  }

  return reply.send({ success: true, data });
}

// ──────────────────────────────────────────────────────────────
// POST /api/driver/register
// Full onboarding — personal + vehicle + bank + referral
// ──────────────────────────────────────────────────────────────
async function completeRegistration(request, reply) {
  const driverId = request.driver.id;

  const {
    fullName, dob, emergencyContact, bloodGroup, tshirtSize, preferredZone,
    vehicleType, specificModelId, vehicleModelName, vehicleWeight,
    vehicleDimensions, bodyType, vehicleNumber,
    accountHolder, bankAccount, ifscCode, referralCode,
  } = request.body;

  // Validation
  if (!fullName || !vehicleType || !vehicleNumber || !bankAccount || !ifscCode || !accountHolder) {
    return reply.code(400).send({
      success: false,
      message: 'Required fields missing: fullName, vehicleType, vehicleNumber, bankAccount, ifscCode, accountHolder',
    });
  }

  try {
    // 1. Update driver profile
    await supabaseAdmin
      .from('driver_profiles')
      .update({
        full_name: fullName,
        dob,
        emergency_contact: emergencyContact,
        blood_group: bloodGroup,
        tshirt_size: tshirtSize,
        preferred_zone: preferredZone,
      })
      .eq('id', driverId);

    // 2. Upsert vehicle
    const vehicleData = {
      driver_id: driverId,
      vehicle_type: vehicleType,
      model_id: specificModelId,
      model_name: vehicleModelName,
      weight_capacity: vehicleWeight,
      dimensions: vehicleDimensions,
      body_type: bodyType,
      registration_number: vehicleNumber.toUpperCase(),
      is_active: true,
    };

    const { error: vehError } = await supabaseAdmin
      .from('driver_vehicles')
      .upsert(vehicleData, { onConflict: 'driver_id' });

    if (vehError && !vehError.message.includes('unique')) {
      throw new Error(`Vehicle save failed: ${vehError.message}`);
    }

    // 3. Upsert bank account
    await supabaseAdmin
      .from('driver_bank_accounts')
      .upsert(
        {
          driver_id: driverId,
          account_holder_name: accountHolder,
          account_number: bankAccount,
          ifsc_code: ifscCode.toUpperCase(),
          is_verified: false,
        },
        { onConflict: 'driver_id' }
      );

    // 4. Handle referral code
    if (referralCode) {
      const { data: referrer } = await supabaseAdmin
        .from('driver_profiles')
        .select('id')
        .eq('referral_code', referralCode.toUpperCase())
        .single();

      if (referrer && referrer.id !== driverId) {
        await supabaseAdmin
          .from('driver_referrals')
          .insert({
            referrer_id: referrer.id,
            referred_id: driverId,
            bonus_paid: false,
          })
          .on('conflict', 'referrer_id,referred_id', () => {});
      }
    }

    // 5. Create empty documents record if not exists
    const { data: existingDocs } = await supabaseAdmin
      .from('driver_documentss')
      .select('id')
      .eq('driver_id', driverId)
      .single();

    if (!existingDocs) {
      await supabaseAdmin.from('driver_documentss').insert({
        driver_id: driverId,
        verification_status: 'pending',
      });
    }

    // 6. Create wallet if not exists
    const { data: existingWallet } = await supabaseAdmin
      .from('driver_wallets')
      .select('id')
      .eq('driver_id', driverId)
      .single();

    if (!existingWallet) {
      // driver_wallets references driver_details.id — use driver_profiles.id
      // Create a matching driver_details entry if needed or insert direct
      await supabaseAdmin.from('driver_wallets').insert({
        driver_id: driverId,
        balance: 0,
        outstanding_dues: 0,
      }).on('conflict', () => {});
    }

    return reply.send({
      success: true,
      message: 'Registration complete. Pending admin approval.',
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────────
// PUT /api/driver/online-status
// Body: { isOnline: true/false }
// ──────────────────────────────────────────────────────────────
async function updateOnlineStatus(request, reply) {
  const driverId = request.driver.id;
  const { isOnline } = request.body;

  if (typeof isOnline !== 'boolean') {
    return reply.code(400).send({ success: false, message: 'isOnline must be boolean' });
  }

  const { error } = await supabaseAdmin
    .from('driver_profiles')
    .update({
      is_online: isOnline,
      status: isOnline ? 'online' : 'offline',
    })
    .eq('id', driverId);

  if (error) {
    return reply.code(500).send({ success: false, message: 'Failed to update status' });
  }

  return reply.send({ success: true, isOnline, status: isOnline ? 'online' : 'offline' });
}

// ──────────────────────────────────────────────────────────────
// POST /api/driver/gps
// Body: { tripId, latitude, longitude, accuracy, speed, heading }
// ──────────────────────────────────────────────────────────────
async function updateGpsLocation(request, reply) {
  const driverId = request.driver.id;
  const { tripId, latitude, longitude, accuracy, speed, heading } = request.body;

  if (!latitude || !longitude) {
    return reply.code(400).send({ success: false, message: 'latitude and longitude required' });
  }

  // Insert GPS record
  await supabaseAdmin.from('driver_gps_locations').insert({
    driver_id: driverId,
    trip_id: tripId || null,
    latitude,
    longitude,
    accuracy: accuracy || null,
    speed: speed || null,
    heading: heading || null,
  });

  // Also emit via Socket.io for live tracking
  const { getIo } = require('../services/socketService');
  const io = getIo();
  if (io) {
    io.to('admin').emit('gps:update', {
      driverId,
      tripId,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    });
  }

  return reply.send({ success: true });
}

// ──────────────────────────────────────────────────────────────
// POST /api/driver/upload-avatar
// Multipart: file field = "avatar"
// ──────────────────────────────────────────────────────────────
async function uploadAvatar(request, reply) {
  const driverId = request.driver.id;

  try {
    const data = await request.file();
    if (!data) return reply.code(400).send({ success: false, message: 'No file uploaded' });

    const buffer = await data.toBuffer();
    const result = await uploadFile({
      bucket: process.env.STORAGE_BUCKET_AVATARS || 'driver-avatars',
      folder: `avatars`,
      filename: data.filename,
      buffer,
      mimetype: data.mimetype,
    });

    await supabaseAdmin
      .from('driver_profiles')
      .update({ avatar_url: result.publicUrl })
      .eq('id', driverId);

    return reply.send({ success: true, url: result.publicUrl });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/driver/upload-document
// Multipart: file + docType (aadhar | pan | license | rc)
// ──────────────────────────────────────────────────────────────
async function uploadDocument(request, reply) {
  const driverId = request.driver.id;

  try {
    const parts = request.parts();
    let docType = null;
    let fileData = null;

    for await (const part of parts) {
      if (part.fieldname === 'docType') {
        docType = part.value;
      } else if (part.type === 'file') {
        fileData = part;
        const buffer = await part.toBuffer();
        fileData.buffer = buffer;
      }
    }

    if (!docType || !fileData) {
      return reply.code(400).send({ success: false, message: 'docType and file are required' });
    }

    const validDocTypes = ['aadhar', 'pan', 'license', 'rc'];
    if (!validDocTypes.includes(docType)) {
      return reply.code(400).send({ success: false, message: `docType must be one of: ${validDocTypes.join(', ')}` });
    }

    const result = await uploadFile({
      bucket: process.env.STORAGE_BUCKET_DOCUMENTS || 'driver-documents',
      folder: `${driverId}/${docType}`,
      filename: fileData.filename,
      buffer: fileData.buffer,
      mimetype: fileData.mimetype,
    });

    // Update the documents record
    const fieldMap = {
      aadhar: 'aadhar_url',
      pan: 'pan_url',
      license: 'license_url',
      rc: 'rc_url',
    };

    await supabaseAdmin
      .from('driver_documentss')
      .upsert(
        {
          driver_id: driverId,
          [fieldMap[docType]]: result.path,
          verification_status: 'pending',
        },
        { onConflict: 'driver_id' }
      );

    return reply.send({ success: true, path: result.path, url: result.publicUrl });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/driver/notifications
// ──────────────────────────────────────────────────────────────
async function getNotifications(request, reply) {
  const driverId = request.driver.id;

  const { data, error } = await supabaseAdmin
    .from('driver_notifications')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return reply.code(500).send({ success: false, message: 'Failed to fetch notifications' });

  // Count unread
  const unreadCount = (data || []).filter((n) => !n.is_read).length;

  return reply.send({ success: true, data: data || [], unreadCount });
}

// ──────────────────────────────────────────────────────────────
// PUT /api/driver/notifications/mark-read
// ──────────────────────────────────────────────────────────────
async function markNotificationsRead(request, reply) {
  const driverId = request.driver.id;

  await supabaseAdmin
    .from('driver_notifications')
    .update({ is_read: true })
    .eq('driver_id', driverId)
    .eq('is_read', false);

  return reply.send({ success: true });
}

module.exports = {
  getProfile,
  updateProfile,
  completeRegistration,
  updateOnlineStatus,
  updateGpsLocation,
  uploadAvatar,
  uploadDocument,
  getNotifications,
  markNotificationsRead,
};
