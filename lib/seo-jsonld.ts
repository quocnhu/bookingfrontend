import type { PublicTour } from "./server-tours";
import type { CompanyInfo } from "./site";
import { absoluteUrl, BRAND, SITE_DESCRIPTION } from "./site";

/**
 * The structured data (JSON-LD) that Google reads.
 *
 * It repeats — in a machine-readable form — what the page already says:
 * the company (Name / Address / Phone), the tours, their prices and the
 * breadcrumb. This is what makes the site eligible for the rich results
 * (prices, ratings, "tour" cards) on Google.
 */

const clean = (html?: string | null): string =>
  (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const number = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** The cheapest adult price of a tour — the "from" price. */
export function tourFromPrice(tour: PublicTour): number {
  const typePrices = (tour.typePrices ?? [])
    .map((p) => number(p.adultPrice))
    .filter((p) => p > 0);
  if (typePrices.length) return Math.min(...typePrices);
  return number(tour.adultPrice);
}

/** The company: the TravelAgency / LocalBusiness entity of the site. */
export function buildOrganizationJsonLd(company: CompanyInfo) {
  const site = absoluteUrl("/");

  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": `${site}#organization`,
    name: company.name || BRAND,
    alternateName: BRAND,
    url: site,
    description: SITE_DESCRIPTION,
    image: absoluteUrl("/opengraph-image"),
    logo: absoluteUrl("/icon.svg"),
    email: company.email ?? undefined,
    telephone: company.phone ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: company.address ?? undefined,
      addressCountry: "VN",
      addressLocality: "Vinh Long",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: company.latitude ?? 10.253,
      longitude: company.longitude ?? 105.972,
    },
    areaServed: {
      "@type": "Country",
      name: "Vietnam",
    },
    sameAs: company.website ? [company.website] : undefined,
  };
}

/** The website itself — the entity of the home page. */
export function buildWebSiteJsonLd() {
  const site = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site}#website`,
    url: site,
    name: BRAND,
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    publisher: { "@id": `${site}#organization` },
  };
}

/** The list of tours on the home page / the listing page. */
export function buildTourListJsonLd(tours: PublicTour[]) {
  const site = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${site}#tours`,
    name: "Vietnam tours",
    numberOfItems: tours.length,
    itemListElement: tours.map((tour, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/tour/${tour.slug || tour.id}`),
      name: tour.name,
    })),
  };
}

/**
 * The graph of a public page: the company, the website and whatever the
 * page is about. The company and the website are repeated on every public
 * page so each page is self-contained for the crawler.
 */
export function buildPublicGraph(
  company: CompanyInfo,
  extra: Record<string, unknown>[],
) {
  const site = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationJsonLd(company),
      buildWebSiteJsonLd(),
      ...extra,
    ],
  };
}

/** A single tour page: the trip, its price and the breadcrumb. */
export function buildTourJsonLd(tour: PublicTour, company?: CompanyInfo) {
  const site = absoluteUrl("/");
  const url = absoluteUrl(`/tour/${tour.slug || tour.id}`);
  const price = tourFromPrice(tour);
  const currency = tour.currency || "VND";
  const description = clean(tour.overview).slice(0, 300);

  const offer = {
    "@type": "Offer",
    url,
    price: price.toFixed(0),
    priceCurrency: currency,
    availability: "https://schema.org/InStock",
    validFrom: new Date().toISOString(),
  };

  const trip = {
    "@type": "TouristTrip",
    "@id": `${url}#tour`,
    name: tour.name,
    description,
    url,
    image: tour.thumbnailUrl
      ? [tour.thumbnailUrl]
      : [absoluteUrl("/opengraph-image")],
    touristType: "https://schema.org/Traveler",
    provider: { "@id": `${site}#organization` },
    itinerary: {
      "@type": "ItemList",
      numberOfItems: tour.itineraries?.length ?? 0,
      itemListElement: (tour.itineraries ?? []).map((it, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: it.title,
        description: clean(it.description) || undefined,
      })),
    },
    offers: offer,
  };

  const product = {
    "@type": "Product",
    "@id": `${url}#product`,
    name: tour.name,
    description,
    image: tour.thumbnailUrl
      ? [tour.thumbnailUrl]
      : [absoluteUrl("/opengraph-image")],
    category: "TravelPackage",
    brand: { "@type": "Brand", name: BRAND },
    url,
    offers: offer,
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site },
      { "@type": "ListItem", position: 2, name: "Tours", item: `${site}tours` },
      {
        "@type": "ListItem",
        position: 3,
        name: tour.name,
        item: url,
      },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      ...(company ? [buildOrganizationJsonLd(company)] : []),
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: `${tour.name} | ${BRAND}`,
        isPartOf: { "@id": `${site}#website` },
        about: { "@id": `${url}#product` },
        inLanguage: "en",
      },
      breadcrumb,
      trip,
      product,
    ],
  };
}
