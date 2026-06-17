import { createContext, useContext, useState, useCallback } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('villa_user')); } catch { return null; }
  });

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

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin', isManager: ['admin','manager'].includes(user?.role) }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
