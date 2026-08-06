'use client';

import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true,
});

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true, timeout: 15000 })
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthCall =
      original.url?.includes('/auth/login') ||
      original.url?.includes('/auth/register') ||
      original.url?.includes('/auth/refresh') ||
      original.url?.includes('/auth/logout');

    if (error.response?.status === 401 && !original._retry && !isAuthCall && typeof window !== 'undefined') {
      original._retry = true;
      const ok = await tryRefresh();
      if (ok) {
        return api(original);
      }
      const { pathname } = window.location;
      const onPublicPage =
        pathname === '/' || pathname === '/login' || pathname === '/register';
      if (!onPublicPage) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error: any, fallback = 'Something went wrong'): string {
  return error?.response?.data?.message ?? error?.message ?? fallback;
}
