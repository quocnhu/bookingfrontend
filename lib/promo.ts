"use client";

export interface PromoFields {
  privateDiscountPercent?: number | null;
  groupDiscountPercent?: number | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
}

const inWindow = (t: PromoFields): boolean => {
  const now = Date.now();
  if (t.promotionStartsAt && now < new Date(t.promotionStartsAt).getTime()) return false;
  if (t.promotionEndsAt && now > new Date(t.promotionEndsAt).getTime()) return false;
  return true;
};

/** Discount percent for a given tour type. */
export function discountFor(
  t: PromoFields,
  type?: string | null,
): number {
  const pct =
    type === "GROUP_TOUR"
      ? Number(t.groupDiscountPercent ?? 0)
      : type === "PRIVATE_TOUR"
        ? Number(t.privateDiscountPercent ?? 0)
        : Number(t.privateDiscountPercent ?? 0) || Number(t.groupDiscountPercent ?? 0);
  return pct > 0 ? pct : 0;
}

/** True when the promotion is currently running for a specific tour type. */
export function isTypePromoActive(
  t: PromoFields,
  type?: string | null,
): boolean {
  const pct = discountFor(t, type);
  return pct > 0 && inWindow(t);
}

/** True when any promotion (private or group) is currently running. */
export function isPromoActive(t: PromoFields): boolean {
  const pct = Math.max(
    Number(t.privateDiscountPercent ?? 0),
    Number(t.groupDiscountPercent ?? 0),
  );
  return pct > 0 && inWindow(t);
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
