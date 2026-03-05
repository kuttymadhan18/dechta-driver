// src/services/uploadService.js
const { supabaseAdmin } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

// ──────────────────────────────────────────────────────────────
// Upload a file buffer to Supabase Storage
// Returns the public URL (for public buckets) or signed URL
// ──────────────────────────────────────────────────────────────
async function uploadFile({ bucket, folder, filename, buffer, mimetype }) {
  const ext = filename.split('.').pop() || 'jpg';
  const uniqueName = `${folder}/${uuidv4()}.${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(uniqueName, buffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) {
    console.error('[Upload Error]', error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL (for public buckets like avatars, promo)
  const { data: urlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(uniqueName);

  return {
    path: data.path,
    publicUrl: urlData.publicUrl,
    bucket,
    filename: uniqueName,
  };
}

// ──────────────────────────────────────────────────────────────
// Get a signed URL for private buckets (documents, package photos)
// Valid for 1 hour by default
// ──────────────────────────────────────────────────────────────
async function getSignedUrl(bucket, path, expiresInSeconds = 3600) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw new Error(`Failed to get signed URL: ${error.message}`);

  return data.signedUrl;
}

// ──────────────────────────────────────────────────────────────
// Delete a file from storage
// ──────────────────────────────────────────────────────────────
async function deleteFile(bucket, path) {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
  if (error) console.error('[Delete File Error]', error.message);
}

module.exports = { uploadFile, getSignedUrl, deleteFile };
