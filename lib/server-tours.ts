import { unstable_cache } from "next/cache";
import { FALLBACK_COMPANY, type CompanyInfo } from "./site";

/**
 * The API address for the SERVER side. It is declared here and not imported
 * from `lib/api.ts`, because that file is a "use client" module — its exports
 * cannot be read from a server component.
 */
const SERVER_API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:4000/api"
).replace(/\/+$/, "");

/**
 * Server-side data access for the PUBLIC pages.
 *
 * The public pages are server components: they fetch the tours on the server
 * so the HTML that Googlebot receives already contains the content. A client
 * component that fetches in `useEffect` renders an EMPTY page for the
 * crawler — the content is only added after the JavaScript runs, and the
 * tour pages would never be indexed.
 *
 * Every call is wrapped: a page must never crash because the API is down.
 */

export type PublicTour = {
  id: string;
  code: string;
  name: string;
  slug?: string | null;
  type: "PRIVATE_TOUR" | "GROUP_TOUR";
  thumbnailUrl?: string | null;
  adultPrice?: number | string | null;
  childPrice?: number | string | null;
  infantPrice?: number | string | null;
  currency?: string;
  durationDays?: number | null;
  departureLocation?: string | null;
  transportation?: string | null;
  overview?: string | null;
  includedServices?: string | null;
  excludedServices?: string | null;
  childrenPolicy?: string | null;
  regulations?: string | null;
  highlights?: string | null;
  insurancePolicy?: string | null;
  mapQuery?: string | null;
  privateDiscountPercent?: number | null;
  groupDiscountPercent?: number | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
  typePrices?: {
    type: "PRIVATE_TOUR" | "GROUP_TOUR";
    adultPrice?: number | string | null;
    childPrice?: number | string | null;
    currency?: string | null;
  }[];
  itineraries?: {
    id?: string;
    dayNumber: number;
    orderIndex: number;
    title: string;
    description?: string | null;
    timeSlot?: string | null;
    location?: string | null;
  }[];
  gallery?: { id: string; url: string; sortIndex: number }[];
};


async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}${path}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * The data is cached for a minute.
 *
 * The pages are `force-dynamic` (so they are never a stale build), but that
 * option also switches the fetch cache off — every page view would become an
 * API call from the same server address, and the backend rate-limits 100
 * requests per minute per IP. `unstable_cache` keeps the page dynamic while
 * the data is re-used for 60 seconds.
 */
const DATA_TTL = 60;

const cachedTours = unstable_cache(
  async () => getJson<{ items?: PublicTour[] }>("/tours?limit=100"),
  ["public-tours"],
  { revalidate: DATA_TTL },
);

const cachedCompany = unstable_cache(
  async () => getJson<CompanyInfo | null>("/company-profile/public"),
  ["public-company"],
  { revalidate: DATA_TTL },
);

const cachedTourBySlug = (slug: string) =>
  unstable_cache(
    async () => getJson<PublicTour>(`/tours/slug/${encodeURIComponent(slug)}`),
    ["public-tour", slug],
    { revalidate: DATA_TTL },
  )();

/** All the tours, newest content first — used by the home page, the listing
 *  page and the sitemap. */
export async function fetchTours(): Promise<PublicTour[]> {
  const data = await cachedTours();
  return data?.items ?? [];
}

/** One tour, by its public slug (the URL) — falls back to the internal id. */
export async function fetchTourBySlug(
  slug: string,
): Promise<PublicTour | null> {
  return cachedTourBySlug(slug);
}

/** The company details used by the footer and the structured data. */
export async function fetchCompany(): Promise<CompanyInfo> {
  const company = await cachedCompany();
  return company ?? FALLBACK_COMPANY;
}

/** The address of a tour page — the slug when it has one. */
export function tourPath(tour: Pick<PublicTour, "id" | "slug">): string {
  return `/tour/${tour.slug || tour.id}`;
}
