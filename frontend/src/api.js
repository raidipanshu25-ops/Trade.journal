/**
 * API client for the FastAPI backend.
 */
const API_BASE = '/api';

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
  })
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

  // Settings
  getSettings: () => apiFetch('/settings'),
  updateSettings: (settings) => apiFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),

  // Trading Journal
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
};
