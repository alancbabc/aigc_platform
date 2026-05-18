import { createContext, useState, useEffect, useCallback } from 'react';

export const AuthContext = createContext(null);

const STORAGE_KEY = 'aigc_auth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { user, token } = JSON.parse(stored);
        if (user && token) {
          setUser(user);
          setToken(token);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAuth = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      user: userData,
      token: authToken,
    }));
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const raw = await res.text().catch(() => '');
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Server error (${res.status})`); }
    if (!res.ok) throw new Error(data.error || 'Login failed');
    saveAuth(data.user, data.token);
    return data;
  }, [saveAuth]);

  const register = useCallback(async (username, password) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const raw = await res.text().catch(() => '');
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Server error (${res.status})`); }
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    saveAuth(data.user, data.token);
    return data;
  }, [saveAuth]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAuthenticated: !loading && !!token,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
