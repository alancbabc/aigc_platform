import { createContext, useState, useEffect, useCallback } from 'react';
import { apiPost } from '../api/client';

export const AuthContext = createContext(null);

const STORAGE_KEY = 'aigc_auth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const { user, token: storedToken } = JSON.parse(stored);
          if (user && storedToken) {
            const res = await fetch('/api/history', {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            if (res.status === 401) {
              localStorage.removeItem(STORAGE_KEY);
            } else if (!res.ok) {
              setUser(user);
              setToken(storedToken);
            } else {
              setUser(user);
              setToken(storedToken);
            }
          }
        }
      } catch {
        // Network error — keep the token, try again next load
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const { user, token: savedToken } = JSON.parse(stored);
            if (user && savedToken) {
              setUser(user);
              setToken(savedToken);
            }
          } catch {}
        }
      } finally {
        setLoading(false);
      }
    })();
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
    const data = await apiPost('/auth/login', { username, password });
    saveAuth(data.user, data.token);
    return data;
  }, [saveAuth]);

  const register = useCallback(async (username, password) => {
    const data = await apiPost('/auth/register', { username, password });
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
