"use client";

export interface PromoFields {
  adultPrice?: string | number | null;
  discountPercent?: number | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
}

/** True when the promotion is currently running (within the window, discount > 0). */
export function isPromoActive(t: PromoFields): boolean {
  if (!t.discountPercent || t.discountPercent <= 0) return false;
  const now = Date.now();
  if (t.promotionStartsAt && now < new Date(t.promotionStartsAt).getTime()) return false;
  if (t.promotionEndsAt && now > new Date(t.promotionEndsAt).getTime()) return false;
  return true;
}

/** Price after applying the discount percent. */
export function discountedPrice(
  price: string | number | null | undefined,
  percent: number | null | undefined,
): number {
  const base = Number(price ?? 0);
  const pct = Number(percent ?? 0);
  if (!pct || pct <= 0) return base;
  return Math.max(0, base * (1 - pct / 100));
}

export interface PromoCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

/** Milliseconds remaining until the promotion window closes (0 if none/none-active). */
export function promoEndsAt(t: PromoFields): number {
  if (!isPromoActive(t)) return 0;
  const end = t.promotionEndsAt ? new Date(t.promotionEndsAt).getTime() : 0;
  const now = Date.now();
  return Math.max(0, end ? end - now : 0);
}

export function splitDuration(ms: number): PromoCountdown {
  const total = Math.max(0, ms);
  const days = Math.floor(total / 86400000);
  const hours = Math.floor((total % 86400000) / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  return { days, hours, minutes, seconds, total };
}
