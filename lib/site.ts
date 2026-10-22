/**
 * The public identity of the website — the single place that holds the
 * Name / Address / Phone (NAP) that Google reads from the structured data.
 *
 * The company details are loaded from the backend at request time (the
 * CompanyProfile table); the constants below are the fallback used while the
 * API is unreachable, and the branding that lives only here.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_WEBSITE_URL ||
  "https://sunshine-travel.vn"
).replace(/\/+$/, "");

export const BRAND = "Hana Tourist";

export const SITE_DESCRIPTION =
  "Handpicked Vietnam tours — Ha Long Bay cruises, Ninh Binh day trips, Hoi An lantern nights, Hoi An & Da Nang private tours. Book a guided day trip or private experience with a local operator.";

export const SITE_KEYWORDS = [
  "vietnam tours",
  "vietnam day tours",
  "ha long bay cruise",
  "ninh binh day trip",
  "hoi an tours",
  "da nang golden bridge",
  "private tour vietnam",
  "group tour vietnam",
  "hanoi tours",
  "vietnam travel",
];

export const DEFAULT_LOCALE = "en_US";

/** The company details shown in the footer and in the structured data. */
export type CompanyInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export const FALLBACK_COMPANY: CompanyInfo = {
  name: "Quoc Nhu Travel",
  address: "Quoi An, Vung Liem, Vinh Long",
  phone: "+84 236 3888 999",
  email: "hello@sunshine-travel.vn",
  website: "https://sunshine-travel.vn",
};

/** An absolute URL — required for canonical links, the sitemap and og:image. */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The public address of a tour page. */
export function tourUrl(slugOrId: string): string {
  return absoluteUrl(`/tour/${slugOrId}`);
}
