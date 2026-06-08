import { showToast } from '../components/common/Toast';

const BASE_URL = '/api';
const HISTORY_CACHE_TTL = 5000;
const HISTORY_CACHE_MAX_ENTRIES = 50;
const historyCache = new Map();
const historyInFlight = new Map();
let historyCacheVersion = 0;

export function getMediaUrl(url) {
  if (!url) return '';
  try {
    const stored = localStorage.getItem('aigc_auth');
    if (stored) {
      const token = JSON.parse(stored).token || '';
      if (token) return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
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

function getHistoryCacheKey(params = {}, token = '') {
  const normalized = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') normalized.set(key, String(value));
  });
  return `${token || 'anonymous'}::${normalized.toString()}`;
}

function buildHistoryEndpoint(params = {}) {
  const normalized = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') normalized.set(key, String(value));
  });
  const query = normalized.toString();
  return query ? `/history?${query}` : '/history';
}

function clearHistoryCache() {
  historyCache.clear();
  historyInFlight.clear();
  historyCacheVersion += 1;
}

function setHistoryCache(cacheKey, value) {
  if (historyCache.has(cacheKey)) historyCache.delete(cacheKey);
  historyCache.set(cacheKey, value);
  while (historyCache.size > HISTORY_CACHE_MAX_ENTRIES) {
    const oldestKey = historyCache.keys().next().value;
    historyCache.delete(oldestKey);
  }
}

async function getHistory(params = {}, options = {}) {
  const token = getToken();
  const cacheKey = getHistoryCacheKey(params, token);
  const requestVersion = historyCacheVersion;
  const cached = historyCache.get(cacheKey);
  const now = Date.now();
  if (
    !options.force &&
    cached &&
    now - cached.time < HISTORY_CACHE_TTL
  ) {
    return cached.data;
  }
  if (!options.force && historyInFlight.has(cacheKey)) return historyInFlight.get(cacheKey);

  const headers = {};
  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  const promise = (async () => {
    const res = await fetch(`${BASE_URL}${buildHistoryEndpoint(params)}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });

    if (res.status === 304 && historyCache.has(cacheKey)) {
      if (requestVersion !== historyCacheVersion && !options.skipStaleRetry) {
        return getHistory(params, { ...options, force: true, skipStaleRetry: true });
      }
      const nextCache = { ...historyCache.get(cacheKey), time: Date.now() };
      setHistoryCache(cacheKey, nextCache);
      return nextCache.data;
    }

    if (res.status === 401) {
      localStorage.removeItem('aigc_auth');
      showToast('会话已过期，请重新登录', 'error', 0);
      setTimeout(() => { window.location.href = '/login'; }, 1500);
      throw new Error('Session expired, please login again');
    }

    const raw = await res.text().catch(() => '');
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(raw.slice(0, 200) || `Server error (${res.status})`); }
    if (!res.ok) throw new Error(data?.error || data?.detail || `Request failed (${res.status})`);

    if (requestVersion !== historyCacheVersion && !options.skipStaleRetry) {
      return getHistory(params, { ...options, force: true, skipStaleRetry: true });
    }

    setHistoryCache(cacheKey, {
      data,
      etag: res.headers.get('ETag'),
      time: Date.now(),
    });
    return data;
  })();

  historyInFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    if (historyInFlight.get(cacheKey) === promise) historyInFlight.delete(cacheKey);
  }
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
  getAll: (params, options) => getHistory(params, options),

  delete: async (id) => {
    const result = await apiRequest(`/history/${id}`, { method: 'DELETE' });
    clearHistoryCache();
    return result;
  },

  clearCache: clearHistoryCache,
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
