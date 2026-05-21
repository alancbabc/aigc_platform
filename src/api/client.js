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

async function apiRequest(endpoint, options = {}) {
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
    window.location.href = '/login';
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

export const generateAPI = {
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
};

export const historyAPI = {
  getAll: () => apiRequest('/history'),

  delete: (id) =>
    apiRequest(`/history/${id}`, { method: 'DELETE' }),
};
