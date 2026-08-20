import { createContext, useContext, useEffect, useState } from 'react';
import { apiLogin, apiLogout, apiRefresh } from '../api/client.js';
import { clearAccessToken, setAccessToken } from './session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const data = await apiRefresh();

        if (!isMounted) {
          return;
        }

        setAccessToken(data.accessToken || null);
        setUser(data.user || null);
      } catch {
        if (isMounted) {
          clearAccessToken();
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    function handleSessionExpired() {
      clearAccessToken();
      setUser(null);
    }

    window.addEventListener('fridge-monitor:session-expired', handleSessionExpired);
    restoreSession();

    return () => {
      isMounted = false;
      window.removeEventListener('fridge-monitor:session-expired', handleSessionExpired);
    };
  }, []);

  async function login(email, password) {
    const data = await apiLogin(email, password);
    setAccessToken(data.accessToken || null);
    setUser(data.user || null);
    return data.user || null;
  }

  async function logout() {
    try {
      await apiLogout();
    } finally {
      clearAccessToken();
      setUser(null);
    }
  }

  const value = {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}