import { showToast } from '../components/common/Toast';

const BASE_URL = '/api';

export function getMediaUrl(url) {
  if (!url) return '';
  try {
    const stored = localStorage.getItem('aigc_auth');
    if (stored) {
      const token = JSON.parse(stored).token || '';
      if (token) return `${url}?token=${encodeURIComponent(token)}`;
    }
  } catch {}
  return url;
}

function getToken() {
  try {
    const stored = localStorage.getItem('aigc_auth');
    if (stored) return JSON.parse(stored).token || '';
  } catch {}
  return '';
}

export async function apiPost(endpoint, body) {
  const res = await fetch(`/api${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text().catch(() => '');
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(raw.slice(0, 200) || `Server error (${res.status})`); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function apiRequest(endpoint, options = {}, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
    try {
      return await _doRequest(endpoint, options);
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') throw err;
      if (err.message === 'Session expired, please login again') throw err;
      if (err.message?.startsWith?.('Server returned 4')) throw err;
    }
  }
  throw lastError;
}

async function _doRequest(endpoint, options = {}) {
  let token = '';
  try {
    const stored = localStorage.getItem('aigc_auth');
    if (stored) {
      token = JSON.parse(stored).token || '';
    }
  } catch {}

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (res.status === 401) {
    localStorage.removeItem('aigc_auth');
    showToast('会话已过期，请重新登录', 'error', 0);
    setTimeout(() => { window.location.href = '/login'; }, 1500);
    throw new Error('Session expired, please login again');
  }

  let data;
  const raw = await res.text().catch(() => '');
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    if (raw) throw new Error(raw.slice(0, 200));
    throw new Error(`Server returned ${res.status} ${res.statusText || 'No Response'}`);
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.detail || `Request failed (${res.status})`);
  }
  return data;
}

export function createGenerationAPI() {
  return {
    image: (params) =>
      apiRequest('/generate/image', {
        method: 'POST',
        body: JSON.stringify(params),
      }),

    video: (params) =>
      apiRequest('/generate/video', {
        method: 'POST',
        body: JSON.stringify(params),
      }),

    audio: (params) =>
      apiRequest('/generate/audio', {
        method: 'POST',
        body: JSON.stringify(params),
      }),

    interpolation: (params) =>
      apiRequest('/generate/interpolation', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
  };
}

export const historyAPI = {
  getAll: () => apiRequest('/history'),

  delete: (id) =>
    apiRequest(`/history/${id}`, { method: 'DELETE' }),
};

export const optimizeAPI = {
  optimize: (params) =>
    apiRequest('/generate/optimize-prompt', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

export const generationTaskAPI = {
  status: (generationId) => apiRequest(`/generate/${generationId}/status`),

  cancel: (generationId) =>
    apiRequest(`/generate/${generationId}/cancel`, {
      method: 'POST',
    }),
};
