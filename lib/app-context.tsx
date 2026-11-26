'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import { BRAND } from './site';

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  role: string;
  authProvider?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
  providerId?: string | null;
  permissions: string[];
  roles?: any[];
}

const ROLE_DEFAULT_ROUTES: Record<string, string> = {
  DRIVER: "/driver/dashboard",
  TOUR_GUIDE: "/tour-guide/dashboard",
  ADMIN: "/dashboard",
  OFFICE: "/dashboard",
  TRANSPORT_PROVIDER: "/transport-provider/dashboard",
  HOTEL: "/hotel/dashboard",
  TOURIST: "/my-bookings",
};

export function getDefaultRoute(role: string): string {
  return ROLE_DEFAULT_ROUTES[role] ?? "/dashboard";
}

export type ThemeMode = 'light' | 'dark';

export interface CompanyBrand {
  id?: string;
  name?: string | null;
  shortName?: string | null;
  logoUrl?: string | null;
}

interface AppContextValue {
  user: SessionUser | null;
  company: CompanyBrand | null;
  loading: boolean;
  theme: ThemeMode;
  toggleTheme: () => void;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (redirect?: string) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  refreshCompany: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AppContext = createContext<AppContextValue>({
  user: null,
  company: null,
  loading: true,
  theme: 'light',
  toggleTheme: () => {},
  login: async () => {},
  loginWithGoogle: () => {},
  logout: () => {},
  refreshProfile: async () => {},
  refreshCompany: async () => {},
  hasPermission: () => false,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [company, setCompany] = useState<CompanyBrand | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const seenBrandsRef = useRef<string[]>([BRAND]);

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

  const fetchCompany = async (): Promise<void> => {
    try {
      const { data } = await api.get('/company-profile');
      setCompany(data ?? null);
    } catch {
      setCompany(null);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (user) void fetchCompany();
    else setCompany(null);
  }, [user]);

  useEffect(() => {
    if (!company || typeof document === "undefined") return;
    const nextBrand = company.shortName?.trim() || BRAND;
    const logoHref = company.logoUrl?.trim() || "/icon.svg";
    const brandSeen = seenBrandsRef.current.includes(nextBrand);
    if (!brandSeen) seenBrandsRef.current.push(nextBrand);

    const syncBrand = () => {
      let title = document.title;
      for (const brand of seenBrandsRef.current) {
        if (brand && brand !== nextBrand && title.includes(brand)) {
          title = title.split(brand).join(nextBrand);
        }
      }
      const pipeIndex = title.lastIndexOf(" | ");
      if (pipeIndex !== -1) {
        const tail = title.slice(pipeIndex + 3);
        if (tail && tail.length <= 60 && !tail.includes(" | ")) {
          title = `${title.slice(0, pipeIndex + 3)}${nextBrand}`;
        }
      } else {
        const dashIndex = title.indexOf(" — ");
        if (dashIndex > 0 && dashIndex <= 60) {
          title = `${nextBrand}${title.slice(dashIndex)}`;
        }
      }
      if (title !== document.title) document.title = title;

      const type = logoHref.endsWith(".svg") ? "image/svg+xml" : "image/png";
      const links = Array.from(
        document.querySelectorAll<HTMLLinkElement>(
          'link[rel="icon"], link[rel="shortcut icon"]',
        ),
      );
      if (links.length === 0) {
        const link = document.createElement("link");
        link.rel = "icon";
        link.href = logoHref;
        link.type = type;
        document.head.appendChild(link);
      } else {
        for (const link of links) {
          link.href = logoHref;
          link.type = type;
        }
      }
      const apple = document.querySelector<HTMLLinkElement>(
        'link[rel="apple-touch-icon"]',
      );
      if (apple) {
        if (logoHref.endsWith(".svg")) apple.remove();
        else apple.href = logoHref;
      }
    };

    syncBrand();
    const timer = window.setTimeout(syncBrand, 300);
    return () => window.clearTimeout(timer);
  }, [company]);

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
      // Cookie has already expired — still log out on the client.
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
      company,
      loading,
      theme,
      toggleTheme,
      login,
      loginWithGoogle,
      logout,
      refreshProfile: fetchProfile,
      refreshCompany: fetchCompany,
      hasPermission,
    }),
    [user, company, loading, theme],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
