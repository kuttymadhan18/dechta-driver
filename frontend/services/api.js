// services/api.js
// ──────────────────────────────────────────────────────────────
// QC Driver App — Centralized API Service
// All backend calls go through this file.
// Replace BASE_URL with your actual Render deployment URL.
// ──────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Config ───────────────────────────────────────────────────
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://qc-driver-backend.onrender.com';

// ── Token Management ─────────────────────────────────────────
export const TokenStore = {
  async get() {
    return await AsyncStorage.getItem('qc_driver_token');
  },
  async set(token) {
    await AsyncStorage.setItem('qc_driver_token', token);
  },
  async remove() {
    await AsyncStorage.removeItem('qc_driver_token');
  },
};

export const DriverStore = {
  async get() {
    const raw = await AsyncStorage.getItem('qc_driver_data');
    return raw ? JSON.parse(raw) : null;
  },
  async set(driver) {
    await AsyncStorage.setItem('qc_driver_data', JSON.stringify(driver));
  },
  async remove() {
    await AsyncStorage.removeItem('qc_driver_data');
  },
};

// ── Core Fetch Wrapper ────────────────────────────────────────
async function apiRequest(endpoint, options = {}) {
  const token = await TokenStore.get();

  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  };

  // For multipart (file uploads) — don't set Content-Type, let fetch set boundary
  if (options.isMultipart) {
    delete config.headers['Content-Type'];
    config.body = options.formData;
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (err) {
    if (err.message === 'Network request failed') {
      throw new Error('No internet connection. Please check your network.');
    }
    throw err;
  }
}

// ═════════════════════════════════════════════════════════════
// AUTH APIs
// ═════════════════════════════════════════════════════════════

export const AuthAPI = {
  // Send OTP to mobile number
  sendOtp: (mobile) =>
    apiRequest('/api/auth/send-otp', { method: 'POST', body: { mobile } }),

  // Verify OTP and get token
  verifyOtp: async (mobile, otp) => {
    const result = await apiRequest('/api/auth/verify-otp', {
      method: 'POST',
      body: { mobile, otp },
    });
    if (result.success && result.token) {
      await TokenStore.set(result.token);
      await DriverStore.set(result.driver);
    }
    return result;
  },

  // Logout
  logout: async () => {
    await TokenStore.remove();
    await DriverStore.remove();
  },

  // Check if logged in
  isLoggedIn: async () => {
    const token = await TokenStore.get();
    return !!token;
  },
};

// ═════════════════════════════════════════════════════════════
// DRIVER APIs
// ═════════════════════════════════════════════════════════════

export const DriverAPI = {
  // Get full profile
  getProfile: () => apiRequest('/api/driver/profile'),

  // Update profile fields
  updateProfile: (data) =>
    apiRequest('/api/driver/profile', { method: 'PUT', body: data }),

  // Complete registration (onboarding form)
  register: (data) =>
    apiRequest('/api/driver/register', { method: 'POST', body: data }),

  // Toggle online/offline
  setOnlineStatus: (isOnline) =>
    apiRequest('/api/driver/online-status', { method: 'PUT', body: { isOnline } }),

  // Send GPS ping
  sendGps: (tripId, latitude, longitude, accuracy, speed, heading) =>
    apiRequest('/api/driver/gps', {
      method: 'POST',
      body: { tripId, latitude, longitude, accuracy, speed, heading },
    }),

  // Upload avatar (multipart)
  uploadAvatar: async (imageUri) => {
    const formData = new FormData();
    formData.append('avatar', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'avatar.jpg',
    });
    return apiRequest('/api/driver/upload-avatar', { method: 'POST', isMultipart: true, formData });
  },

  // Upload KYC document (multipart)
  uploadDocument: async (imageUri, docType) => {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: `${docType}.jpg`,
    });
    formData.append('docType', docType);
    return apiRequest('/api/driver/upload-document', { method: 'POST', isMultipart: true, formData });
  },

  // Get notifications
  getNotifications: () => apiRequest('/api/driver/notifications'),

  // Mark all notifications read
  markNotificationsRead: () => apiRequest('/api/driver/notifications/mark-read', { method: 'PUT' }),
};

// ═════════════════════════════════════════════════════════════
// ORDERS APIs
// ═════════════════════════════════════════════════════════════

export const OrdersAPI = {
  // Get available orders
  getAvailable: () => apiRequest('/api/orders/available'),

  // Get active trip
  getActive: () => apiRequest('/api/orders/active'),

  // Accept an order
  accept: (orderId) =>
    apiRequest(`/api/orders/${orderId}/accept`, { method: 'POST' }),

  // Ignore/miss an order
  ignore: (orderId) =>
    apiRequest(`/api/orders/${orderId}/ignore`, { method: 'POST' }),

  // Mark arrived at pickup
  arrivedPickup: (tripId) =>
    apiRequest(`/api/orders/trips/${tripId}/arrived-pickup`, { method: 'POST' }),

  // Confirm pickup with photo (multipart)
  confirmPickup: async (tripId, photoUri) => {
    const formData = new FormData();
    formData.append('photo', {
      uri: photoUri,
      type: 'image/jpeg',
      name: 'pickup_photo.jpg',
    });
    return apiRequest(`/api/orders/trips/${tripId}/confirm-pickup`, {
      method: 'POST',
      isMultipart: true,
      formData,
    });
  },

  // Mark arrived at dropoff
  arrivedDropoff: (tripId) =>
    apiRequest(`/api/orders/trips/${tripId}/arrived-dropoff`, { method: 'POST' }),

  // Complete delivery with OTP
  complete: (tripId, otp) =>
    apiRequest(`/api/orders/trips/${tripId}/complete`, { method: 'POST', body: { otp } }),

  // Cancel trip
  cancel: (tripId, reason) =>
    apiRequest(`/api/orders/trips/${tripId}/cancel`, { method: 'POST', body: { reason } }),

  // Get order history
  getHistory: (status = 'Completed', page = 1) =>
    apiRequest(`/api/orders/history?status=${status}&page=${page}`),
};

// ═════════════════════════════════════════════════════════════
// EARNINGS APIs
// ═════════════════════════════════════════════════════════════

export const EarningsAPI = {
  get: (timeframe = 'daily', date = null, startDate = null, endDate = null) => {
    let url = `/api/earnings?timeframe=${timeframe}`;
    if (date) url += `&date=${date}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    return apiRequest(url);
  },

  getSummary: () => apiRequest('/api/earnings/summary'),
};

// ═════════════════════════════════════════════════════════════
// WALLET APIs
// ═════════════════════════════════════════════════════════════

export const WalletAPI = {
  get: () => apiRequest('/api/wallet'),
  withdraw: (amount, upiId) =>
    apiRequest('/api/wallet/withdraw', { method: 'POST', body: { amount, upiId } }),
  payDues: (amount) =>
    apiRequest('/api/wallet/pay-dues', { method: 'POST', body: { amount } }),
};

// ═════════════════════════════════════════════════════════════
// MISC APIs
// ═════════════════════════════════════════════════════════════

export const MiscAPI = {
  getLeaderboard: () => apiRequest('/api/leaderboard'),
  getPromos: () => apiRequest('/api/promos'),
  getAchievements: () => apiRequest('/api/achievements'),
  getChatMessages: (tripId) => apiRequest(`/api/trips/${tripId}/chat`),
  sendChatMessage: (tripId, message) =>
    apiRequest(`/api/trips/${tripId}/chat`, { method: 'POST', body: { message } }),
};

export default apiRequest;
