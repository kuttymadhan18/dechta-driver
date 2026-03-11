// src/services/uploadService.js
// ──────────────────────────────────────────────────────────────
// File Upload Service — Cloudinary (same as vendor app)
// File Upload Service
// ──────────────────────────────────────────────────────────────
const { v4: uuidv4 } = require('uuid');

// Cloudinary upload via REST API (no SDK needed, just fetch)
async function uploadToCloudinary({ folder, filename, buffer, mimetype }) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    // Dev mode: return a placeholder URL if Cloudinary not configured
    console.warn('[Upload] Cloudinary not configured — returning placeholder URL');
    return {
      path: `${folder}/${uuidv4()}`,
      publicUrl: `https://res.cloudinary.com/placeholder/${folder}/image.jpg`,
      bucket: folder,
    };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${folder}/${uuidv4()}`;

  // Build signature
  const crypto = require('crypto');
  const sigString = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(sigString).digest('hex');

  // Build form data
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', buffer, { filename: filename || 'upload.jpg', contentType: mimetype });
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append('folder', folder);
  form.append('signature', signature);

  const axios = require('axios');
  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    form,
    { headers: form.getHeaders() }
  );

  return {
    path: response.data.public_id,
    publicUrl: response.data.secure_url,
    bucket: folder,
    filename: response.data.public_id,
  };
}

// ──────────────────────────────────────────────────────────────
// Main upload function
// ──────────────────────────────────────────────────────────────
async function uploadFile({ bucket, folder, filename, buffer, mimetype }) {
  const uploadFolder = `dechta/${bucket}/${folder}`;
  return uploadToCloudinary({ folder: uploadFolder, filename, buffer, mimetype });
}

module.exports = { uploadFile };
