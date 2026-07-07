import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

const INACTIVITY_LIMIT = 60 * 60 * 1000; // 1 hour in ms
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('villa_user')); } catch { return null; }
  });
  const timerRef = useRef(null);

  const login = useCallback(async (email, password) => {
    const { data } = await client.post('/login', { email, password });
    localStorage.setItem('villa_token', data.token);
    localStorage.setItem('villa_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await client.post('/logout'); } catch {}
    localStorage.removeItem('villa_token');
    localStorage.removeItem('villa_user');
    setUser(null);
  }, []);

  const forceLogout = useCallback(() => {
    localStorage.removeItem('villa_token');
    localStorage.removeItem('villa_user');
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener('auth:unauthorized', forceLogout);
    return () => window.removeEventListener('auth:unauthorized', forceLogout);
  }, [forceLogout]);

  useEffect(() => {
    if (!user) return;

    const reset = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => logout(), INACTIVITY_LIMIT);
    };

    reset();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));

    return () => {
      clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [user, logout]);

  const updateUser = useCallback((updated) => {
    localStorage.setItem('villa_user', JSON.stringify(updated));
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isAdmin: user?.role === 'admin', isManager: ['admin','manager'].includes(user?.role) }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
