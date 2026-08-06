'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  role: string;
  userType?: string | null;
  authProvider?: string | null;
  createdAt?: string | null;
  permissions: string[];
  roles?: any[];
}

export type ThemeMode = 'light' | 'dark';

interface AppContextValue {
  user: SessionUser | null;
  loading: boolean;
  theme: ThemeMode;
  toggleTheme: () => void;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (redirect?: string) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AppContext = createContext<AppContextValue>({
  user: null,
  loading: true,
  theme: 'light',
  toggleTheme: () => {},
  login: async () => {},
  loginWithGoogle: () => {},
  logout: () => {},
  refreshProfile: async () => {},
  hasPermission: () => false,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    const storedTheme = localStorage.getItem('booking.theme');
    if (storedTheme === 'dark' || storedTheme === 'light') {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  const fetchProfile = async (): Promise<void> => {
    try {
      const { data } = await api.get('/auth/profile');
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const login = async (email: string, password: string) => {
    await api.post('/auth/login', { email, password });
    await fetchProfile();
  };

  const loginWithGoogle = (redirect?: string) => {
    const target = redirect ?? window.location.pathname;
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/google?redirect=${encodeURIComponent(target)}`;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Cookie đã hết hạn — vẫn đăng xuất ở client.
    }
    setUser(null);
    router.push('/login');
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('booking.theme', next);
      return next;
    });
  };

  const hasPermission = (permission: string) => {
    if (!user) return false;
    return user.role === 'ADMIN' || user.permissions?.includes(permission);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      theme,
      toggleTheme,
      login,
      loginWithGoogle,
      logout,
      refreshProfile: fetchProfile,
      hasPermission,
    }),
    [user, loading, theme],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
