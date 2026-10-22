import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PublicTourDetail from "@/components/tour/public-tour-detail";
import { fetchCompany, fetchTourBySlug, type PublicTour } from "@/lib/server-tours";
import { absoluteUrl, BRAND, SITE_URL } from "@/lib/site";
import { buildTourJsonLd } from "@/lib/seo-jsonld";
import { sanitizeTourHtml } from "@/lib/sanitize-server";

/**
 * The public tour page: /tour/ha-long-bay-full-day-cruise
 *
 * A SERVER component: the tour is fetched on the server, so the HTML that
 * Googlebot receives already contains the tour, its itinerary and its price.
 * A page that fetches in a `useEffect` is empty for the crawler.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tour = await fetchTourBySlug(slug);
  if (!tour) {
    return { title: "Tour not found", robots: { index: false, follow: true } };
  }

  const canonical = absoluteUrl(`/tour/${tour.slug || tour.id}`);
  const description = tourDescription(tour);

  return {
    title: `${tour.name} — ${tour.type === "PRIVATE_TOUR" ? "Private Tour" : "Group Tour"} in Vietnam`,
    description,
    keywords: [
      tour.name,
      "vietnam tour",
      tour.departureLocation ?? "vietnam",
      tour.type === "PRIVATE_TOUR" ? "private tour" : "group tour",
      tour.durationDays ? `${tour.durationDays} day tour` : "day tour",
    ].filter(Boolean),
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: BRAND,
      url: canonical,
      title: `${tour.name} | ${BRAND}`,
      description,
      images: tour.thumbnailUrl
        ? [{ url: tour.thumbnailUrl, alt: tour.name }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${tour.name} | ${BRAND}`,
      description,
      images: tour.thumbnailUrl ? [tour.thumbnailUrl] : undefined,
    },
  };
}

export default async function PublicTourPage({ params }: Params) {
  const { slug } = await params;
  const tour = await fetchTourBySlug(slug);
  if (!tour) notFound();

  // The canonical address of a tour is its slug. An old link
  // (/tour/<uuid>) is redirected to it, so the same tour is never split
  // over several URLs — Google would then index two pages for one tour.
  const canonicalSlug = tour.slug || tour.id;
  if (slug !== canonicalSlug) {
    redirect(absoluteUrl(`/tour/${canonicalSlug}`));
  }

  const company = await fetchCompany();
  const jsonLd = buildTourJsonLd(tour, company);
  // The HTML is cleaned on the server — DOMPurify needs a browser DOM and
  // the public pages are rendered on the server.
  const safeTour = sanitizeTourHtml(tour);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicTourDetail tour={safeTour as unknown as PublicTour} />
    </>
  );
}

/** The meta description of a tour — the first lines of its overview. */
function tourDescription(tour: PublicTour): string {
  const plain = (tour.overview ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const place = tour.departureLocation ?? "Vietnam";
  const days = tour.durationDays ?? 1;

  if (plain) {
    return plain.length > 155 ? `${plain.slice(0, 152)}...` : plain;
  }
  return `${tour.name} — a ${days}-day ${tour.type === "PRIVATE_TOUR" ? "private" : "group"} tour in ${place}. Book online with ${BRAND}.`;
}

/** The canonical origin of the site — used by the JSON-LD. */
export const siteOrigin = SITE_URL;
