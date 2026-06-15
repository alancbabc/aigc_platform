import { createContext, useCallback, useEffect, useState } from 'react';
import { apiPost, historyAPI } from '../api/client';
import { clearAuth, clearLegacyAuth, readAuth, saveAuth as saveStoredAuth } from '../utils/authStorage';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      clearLegacyAuth();
      try {
        const stored = readAuth();
        if (stored?.user && stored?.token) {
          const res = await fetch('/api/history', {
            headers: { Authorization: `Bearer ${stored.token}` },
          });
          if (res.status === 401) {
            clearAuth();
          } else if (res.ok) {
            setUser(stored.user);
            setToken(stored.token);
          }
        }
      } catch {
        const stored = readAuth();
        if (stored?.user && stored?.token) {
          setUser(stored.user);
          setToken(stored.token);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveAuth = useCallback((userData, authToken) => {
    historyAPI.clearCache();
    setUser(userData);
    setToken(authToken);
    saveStoredAuth(userData, authToken);
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
    historyAPI.clearCache();
    setUser(null);
    setToken(null);
    clearAuth();
    sessionStorage.removeItem('aigc_tasks');
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
