// src/controllers/driverController.js
const { query }           = require('../config/db');
const { uploadFile }      = require('../services/uploadService');
const { pushNotification } = require('../services/socketService');

// ──────────────────────────────────────────────────────────────
// GET /api/driver/profile
// ──────────────────────────────────────────────────────────────
async function getProfile(request, reply) {
  const driverId = request.driver.id;

  const [profileRes, statsRes, vehicleRes, bankRes, docsRes, walletRes] = await Promise.all([
    query(`SELECT * FROM driver_profiles WHERE id = $1`, [driverId]),
    query(`SELECT * FROM driver_stats WHERE driver_id = $1`, [driverId]),
    query(`SELECT * FROM driver_vehicles WHERE driver_id = $1 LIMIT 1`, [driverId]),
    query(`SELECT * FROM driver_bank_accounts WHERE driver_id = $1 LIMIT 1`, [driverId]),
    query(`SELECT * FROM driver_documentss WHERE driver_id = $1 LIMIT 1`, [driverId]),
    query(`SELECT balance, outstanding_dues FROM driver_wallets WHERE driver_id = $1`, [driverId]),
  ]);

  if (!profileRes.rows.length) {
    return reply.code(404).send({ success: false, message: 'Profile not found' });
  }

  return reply.send({
    success: true,
    data: {
      profile:   profileRes.rows[0],
      stats:     statsRes.rows[0]   || {},
      vehicle:   vehicleRes.rows[0] || null,
      bank:      bankRes.rows[0]    || null,
      documents: docsRes.rows[0]    || null,
      wallet:    walletRes.rows[0]  || { balance: 0, outstanding_dues: 0 },
    },
  });
}

// ──────────────────────────────────────────────────────────────
// PUT /api/driver/profile
// ──────────────────────────────────────────────────────────────
async function updateProfile(request, reply) {
  const driverId = request.driver.id;
  const { fullName, dob, bloodGroup, tshirtSize, preferredZone, emergencyContact } = request.body;

  const fields = [];
  const values = [];
  let idx = 1;

  if (fullName)        { fields.push(`full_name = $${idx++}`);        values.push(fullName); }
  if (dob)             { fields.push(`dob = $${idx++}`);              values.push(dob); }
  if (bloodGroup)      { fields.push(`blood_group = $${idx++}`);      values.push(bloodGroup); }
  if (tshirtSize)      { fields.push(`tshirt_size = $${idx++}`);      values.push(tshirtSize); }
  if (preferredZone)   { fields.push(`preferred_zone = $${idx++}`);   values.push(preferredZone); }
  if (emergencyContact){ fields.push(`emergency_contact = $${idx++}`);values.push(emergencyContact); }

  if (!fields.length) {
    return reply.code(400).send({ success: false, message: 'No fields to update' });
  }

  values.push(driverId);
  const { rows } = await query(
    `UPDATE driver_profiles SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  return reply.send({ success: true, data: rows[0] });
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

  if (!fullName || !vehicleType || !vehicleNumber || !bankAccount || !ifscCode || !accountHolder) {
    return reply.code(400).send({
      success: false,
      message: 'Required fields missing: fullName, vehicleType, vehicleNumber, bankAccount, ifscCode, accountHolder',
    });
  }

  try {
    // 1. Update driver profile
    await query(
      `UPDATE driver_profiles
       SET full_name=$1, dob=$2, emergency_contact=$3, blood_group=$4, tshirt_size=$5, preferred_zone=$6
       WHERE id=$7`,
      [fullName, dob || null, emergencyContact || null, bloodGroup || null, tshirtSize || null, preferredZone || null, driverId]
    );

    // 2. Upsert vehicle
    await query(
      `INSERT INTO driver_vehicles
         (driver_id, vehicle_type, model_id, model_name, weight_capacity, dimensions, body_type, registration_number, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
       ON CONFLICT (driver_id)
       DO UPDATE SET
         vehicle_type=$2, model_id=$3, model_name=$4, weight_capacity=$5,
         dimensions=$6, body_type=$7, registration_number=$8, is_active=true`,
      [driverId, vehicleType, specificModelId || null, vehicleModelName || null,
       vehicleWeight || null, vehicleDimensions || null, bodyType || null,
       vehicleNumber.toUpperCase()]
    );

    // 3. Upsert bank account
    await query(
      `INSERT INTO driver_bank_accounts
         (driver_id, account_holder_name, account_number, ifsc_code, is_verified)
       VALUES ($1,$2,$3,$4,false)
       ON CONFLICT (driver_id)
       DO UPDATE SET account_holder_name=$2, account_number=$3, ifsc_code=$4`,
      [driverId, accountHolder, bankAccount, ifscCode.toUpperCase()]
    );

    // 4. Handle referral
    if (referralCode) {
      const { rows: referrer } = await query(
        `SELECT id FROM driver_profiles WHERE referral_code = $1 AND id != $2`,
        [referralCode.toUpperCase(), driverId]
      );
      if (referrer.length) {
        await query(
          `INSERT INTO driver_referrals (referrer_id, referred_id, bonus_paid)
           VALUES ($1,$2,false)
           ON CONFLICT (referrer_id, referred_id) DO NOTHING`,
          [referrer[0].id, driverId]
        );
      }
    }

    // 5. Create documents record if missing
    await query(
      `INSERT INTO driver_documentss (driver_id, verification_status)
       VALUES ($1,'pending')
       ON CONFLICT (driver_id) DO NOTHING`,
      [driverId]
    );

    // 6. Create wallet if missing
    await query(
      `INSERT INTO driver_wallets (driver_id, balance, outstanding_dues)
       VALUES ($1,0,0)
       ON CONFLICT (driver_id) DO NOTHING`,
      [driverId]
    );

    return reply.send({ success: true, message: 'Registration complete. Pending admin approval.' });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────────
// PUT /api/driver/online-status
// ──────────────────────────────────────────────────────────────
async function updateOnlineStatus(request, reply) {
  const driverId  = request.driver.id;
  const { isOnline } = request.body;

  if (typeof isOnline !== 'boolean') {
    return reply.code(400).send({ success: false, message: 'isOnline must be boolean' });
  }

  await query(
    `UPDATE driver_profiles SET is_online=$1, status=$2 WHERE id=$3`,
    [isOnline, isOnline ? 'online' : 'offline', driverId]
  );

  return reply.send({ success: true, isOnline, status: isOnline ? 'online' : 'offline' });
}

// ──────────────────────────────────────────────────────────────
// POST /api/driver/gps
// ──────────────────────────────────────────────────────────────
async function updateGpsLocation(request, reply) {
  const driverId = request.driver.id;
  const { tripId, latitude, longitude, accuracy, speed, heading } = request.body;

  if (!latitude || !longitude) {
    return reply.code(400).send({ success: false, message: 'latitude and longitude required' });
  }

  await query(
    `INSERT INTO driver_gps_locations (driver_id, trip_id, latitude, longitude, accuracy, speed, heading)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [driverId, tripId || null, latitude, longitude, accuracy || null, speed || null, heading || null]
  );

  // Emit via Socket.io for live tracking
  const { getIo } = require('../services/socketService');
  const io = getIo();
  if (io) {
    io.to('admin').emit('gps:update', { driverId, tripId, latitude, longitude, timestamp: new Date().toISOString() });
  }

  return reply.send({ success: true });
}

// ──────────────────────────────────────────────────────────────
// POST /api/driver/upload-avatar
// ──────────────────────────────────────────────────────────────
async function uploadAvatar(request, reply) {
  const driverId = request.driver.id;

  try {
    const data = await request.file();
    if (!data) return reply.code(400).send({ success: false, message: 'No file uploaded' });

    const buffer = await data.toBuffer();
    const result = await uploadFile({
      bucket:   process.env.STORAGE_BUCKET_AVATARS || 'driver-avatars',
      folder:   'avatars',
      filename: data.filename,
      buffer,
      mimetype: data.mimetype,
    });

    await query(
      `UPDATE driver_profiles SET avatar_url=$1 WHERE id=$2`,
      [result.publicUrl, driverId]
    );

    return reply.send({ success: true, url: result.publicUrl });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/driver/upload-document
// ──────────────────────────────────────────────────────────────
async function uploadDocument(request, reply) {
  const driverId = request.driver.id;

  try {
    const parts   = request.parts();
    let docType   = null;
    let fileData  = null;

    for await (const part of parts) {
      if (part.fieldname === 'docType') {
        docType = part.value;
      } else if (part.type === 'file') {
        const buffer    = await part.toBuffer();
        fileData        = { ...part, buffer };
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
      bucket:   process.env.STORAGE_BUCKET_DOCUMENTS || 'driver-documents',
      folder:   `${driverId}/${docType}`,
      filename: fileData.filename,
      buffer:   fileData.buffer,
      mimetype: fileData.mimetype,
    });

    const fieldMap = { aadhar: 'aadhar_url', pan: 'pan_url', license: 'license_url', rc: 'rc_url' };

    await query(
      `INSERT INTO driver_documentss (driver_id, ${fieldMap[docType]}, verification_status)
       VALUES ($1,$2,'pending')
       ON CONFLICT (driver_id)
       DO UPDATE SET ${fieldMap[docType]}=$2, verification_status='pending'`,
      [driverId, result.path]
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

  const { rows } = await query(
    `SELECT * FROM driver_notifications WHERE driver_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [driverId]
  );

  const unreadCount = rows.filter((n) => !n.is_read).length;
  return reply.send({ success: true, data: rows, unreadCount });
}

// ──────────────────────────────────────────────────────────────
// PUT /api/driver/notifications/mark-read
// ──────────────────────────────────────────────────────────────
async function markNotificationsRead(request, reply) {
  const driverId = request.driver.id;

  await query(
    `UPDATE driver_notifications SET is_read=true WHERE driver_id=$1 AND is_read=false`,
    [driverId]
  );

  return reply.send({ success: true });
}

module.exports = {
  getProfile, updateProfile, completeRegistration,
  updateOnlineStatus, updateGpsLocation,
  uploadAvatar, uploadDocument,
  getNotifications, markNotificationsRead,
};
