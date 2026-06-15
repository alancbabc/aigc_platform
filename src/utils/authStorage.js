const AUTH_STORAGE_KEY = 'aigc_auth';

function getSession() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getLocal() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readAuth() {
  const session = getSession();
  if (!session) return null;
  try {
    const stored = session.getItem(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveAuth(user, token) {
  const session = getSession();
  if (!session) return;
  session.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token }));
  clearLegacyAuth();
}

export function clearAuth() {
  getSession()?.removeItem(AUTH_STORAGE_KEY);
  clearLegacyAuth();
}

export function clearLegacyAuth() {
  getLocal()?.removeItem(AUTH_STORAGE_KEY);
}

export function getAuthToken() {
  return readAuth()?.token || '';
}
