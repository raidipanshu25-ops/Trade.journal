/**
 * API client for the FastAPI backend.
 */
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function apiFetch(endpoint, options = {}) {
  try {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    
    // Attach JWT token if it exists
    const token = localStorage.getItem('tj-auth-token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers,
      ...options,
    });

    if (res.status === 401 && endpoint !== '/auth/login') {
      // Token is expired/invalid. Redirect UI.
      localStorage.removeItem('tj-auth-token');
      window.dispatchEvent(new Event('auth-expired'));
      throw new Error(`Unauthorized (401)`);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`API error [${endpoint}]:`, err);
    throw err;
  }
}

export const authApi = {
  login: (username, password) => apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),
  googleLogin: (token) => apiFetch('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ token }),
  }),
  register: (username, email, password) => apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  }),
  verify2FA: (code, temp_token = '') => apiFetch('/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ code, temp_token }),
  }),
  getMe: () => apiFetch('/auth/me'),
  changePassword: (current_password, new_password) => apiFetch('/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify({ current_password, new_password }),
  }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  getSessions: () => apiFetch('/auth/sessions'),
  revokeSession: (sessionId) => apiFetch(`/auth/sessions/${sessionId}`, { method: 'DELETE' }),
  setup2FA: () => apiFetch('/auth/2fa/setup', { method: 'POST' }),
  disable2FA: (code) => apiFetch('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }),
};

export const adminApi = {
  getUsers: () => apiFetch('/admin/users'),
  createUser: (data) => apiFetch('/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateRole: (userId, role) => apiFetch(`/admin/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  }),
  updateStatus: (userId, status) => apiFetch(`/admin/users/${userId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),
  resetPassword: (userId, new_password) => apiFetch(`/admin/users/${userId}/reset-password`, {
    method: 'PUT',
    body: JSON.stringify({ new_password }),
  }),
  deleteUser: (userId) => apiFetch(`/admin/users/${userId}`, { method: 'DELETE' }),
};

export const api = {
  // Health
  health: () => apiFetch('/health'),

  // Account
  account: () => apiFetch('/account'),

  // Positions
  positions: () => apiFetch('/positions'),

  // Daily stats
  dailyStats: () => apiFetch('/daily-stats'),

  // Deals
  todayDeals: () => apiFetch('/deals'),

  // Discipline
  runCheck: () => apiFetch('/discipline/check'),
  getAlerts: (date) => apiFetch(`/discipline/alerts${date ? `?date=${date}` : ''}`),

  // AI Analysis
  runAnalysis: (body = {}) => apiFetch('/analysis', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  analysisHistory: (date) => apiFetch(`/analysis/history${date ? `?date=${date}` : ''}`),
  aiStatus: () => apiFetch('/ai-status'),

  // Settings
  getSettings: () => apiFetch('/settings'),
  updateSettings: (settings) => apiFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),

  // AI Powered Trading Journal & Analytics
  journalTrades: (options = {}) => {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);
    if (options.date) params.append('date', options.date);
    if (options.symbol) params.append('symbol', options.symbol);
    const q = params.toString();
    return apiFetch(`/journal/trades${q ? `?${q}` : ''}`);
  },
  journalStats: () => apiFetch('/journal/stats'),
  syncJournal: () => apiFetch('/journal/sync', { method: 'POST' }),

  // Reconnect
  reconnect: () => apiFetch('/mt5/reconnect', { method: 'POST' }),

  // Chart Vision
  chartUpload: (body) => apiFetch('/chart/upload', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  chartSnapshots: (options = {}) => {
    const params = new URLSearchParams();
    if (options.date) params.append('date', options.date);
    if (options.symbol) params.append('symbol', options.symbol);
    if (options.limit) params.append('limit', options.limit);
    const q = params.toString();
    return apiFetch(`/chart/snapshots${q ? `?${q}` : ''}`);
  },
  chartSnapshot: (id) => apiFetch(`/chart/snapshot/${id}`),
  chartAnalyze: (id) => apiFetch(`/chart/analyze/${id}`, { method: 'POST' }),
  chartExport: (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return `/api/chart/export${params.toString() ? `?${params}` : ''}`;
  },
  chartDelete: (id) => apiFetch(`/chart/snapshot/${id}`, { method: 'DELETE' }),

  // MT5 Accounts (MetaAPI cloud)
  mt5Accounts: () => apiFetch('/mt5-accounts'),
  addMt5Account: (payload) => apiFetch('/mt5-accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  deleteMt5Account: (id) => apiFetch(`/mt5-accounts/${id}`, { method: 'DELETE' }),
  syncMt5Account: (id) => apiFetch(`/mt5-accounts/${id}/sync`, { method: 'POST' }),
  deployMt5Account: (id) => apiFetch(`/mt5-accounts/${id}/deploy`, { method: 'POST' }),

  // MT5 Access Controller (prop-firm safe gatekeeper)
  mt5AccessStatus: () => apiFetch('/mt5-access/status'),
  mt5AccessOverride: (action) => apiFetch('/mt5-access/override', {
    method: 'POST',
    body: JSON.stringify({ action }),
  }),
  mt5AccessForceOpen: () => apiFetch('/mt5-access/force-open', { method: 'POST' }),
  mt5AccessReset: () => apiFetch('/mt5-access/reset', { method: 'POST' }),

  // Morning Ritual
  getRitual: () => apiFetch('/ritual/today'),
  completeRitual: (body) => apiFetch('/ritual/complete', { method: 'POST', body: JSON.stringify(body) }),

  // Pre-Trade Gate
  logPreTrade: (body) => apiFetch('/pre-trade/log', { method: 'POST', body: JSON.stringify(body) }),
  getPreTradeLogs: (date) => apiFetch(`/pre-trade/logs${date ? `?date=${date}` : ''}`),

  // Post-Trade Reflection
  logReflection: (body) => apiFetch('/reflection/log', { method: 'POST', body: JSON.stringify(body) }),
  getReflections: (date) => apiFetch(`/reflection/logs${date ? `?date=${date}` : ''}`),

  // MT5 Connector / Sync Token
  getSyncToken: () => apiFetch('/user/sync-token'),
  generateSyncToken: () => apiFetch('/user/sync-token', { method: 'POST' }),
  getSyncStatus: () => apiFetch('/sync/status'),

  // Public config
  getConfig: () => apiFetch('/config'),
};
