import { useState, useEffect } from 'react';

const BASE_URL = '/api';

function getToken() {
  try {
    const stored = localStorage.getItem('aigc_auth');
    if (stored) return JSON.parse(stored).token || '';
  } catch {}
  return '';
}

/**
 * 通过 Authorization header 鉴权获取媒体文件的 blob URL，
 * 避免 JWT 泄露在 URL 中。
 */
export function useMediaUrl(url) {
  const [blobUrl, setBlobUrl] = useState('');

  useEffect(() => {
    if (!url) { setBlobUrl(''); return; }

    const token = getToken();
    if (!token) { setBlobUrl(url); return; }

    let cancelled = false;
    const pathParts = url.replace(/^\/outputs\//, '').split('/');
    const user = pathParts[0];
    const fileName = pathParts.slice(1).join('/');

    fetch(`${BASE_URL}/media/${user}/${fileName}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error('Media load failed');
        return r.blob();
      })
      .then(blob => {
        if (!cancelled) setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => { if (!cancelled) setBlobUrl(''); });

    return () => { cancelled = true; };
  }, [url]);

  return blobUrl;
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

export const taskAPI = {
  getStatus: (taskId) => apiRequest(`/generate/status/${taskId}`),
  getActive: () => apiRequest('/generate/tasks'),
};

export function useTaskPolling() {
  const [taskId, setTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState('idle');
  const [taskResult, setTaskResult] = useState(null);
  const [taskError, setTaskError] = useState(null);

  useEffect(() => {
    if (!taskId) return;

    let stopped = false;
    let pollCount = 0;

    const poll = async () => {
      try {
        const data = await taskAPI.getStatus(taskId);
        if (stopped) return;
        setTaskStatus(data.status);
        if (data.status === 'done') {
          setTaskResult(data.result);
        } else if (data.status === 'error') {
          setTaskError(data.error);
        } else {
          pollCount++;
          const delay = pollCount < 6 ? 5000 : 10000;
          setTimeout(poll, delay);
        }
      } catch {
        if (!stopped) setTimeout(poll, 10000);
      }
    };

    poll();
    return () => { stopped = true; };
  }, [taskId]);

  useEffect(() => {
    taskAPI.getActive().then(data => {
      const active = data.tasks?.[0];
      if (active) {
        setTaskId(active.taskId);
        setTaskStatus(active.status);
      }
    }).catch(() => {});
  }, []);

  const startTask = (id) => {
    setTaskId(id);
    setTaskStatus('pending');
    setTaskResult(null);
    setTaskError(null);
  };

  const resetTask = () => {
    setTaskId(null);
    setTaskStatus('idle');
    setTaskResult(null);
    setTaskError(null);
  };

  const isGenerating = taskStatus === 'pending' || taskStatus === 'processing';

  return { taskId, taskStatus, taskResult, taskError, isGenerating, startTask, resetTask };
}
