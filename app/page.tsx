import type { Metadata } from "next";
import HomePage from "@/components/home-page";
import { fetchCompany, fetchTours } from "@/lib/server-tours";
import { buildPublicGraph, buildTourListJsonLd } from "@/lib/seo-jsonld";
import { absoluteUrl, BRAND, SITE_DESCRIPTION, SITE_KEYWORDS } from "@/lib/site";

/**
 * The public home page.
 *
 * A SERVER component: the tours are fetched on the server, so the HTML that
 * Googlebot receives already lists every tour with its price. A page that
 * fetches in a `useEffect` is EMPTY for the crawler — the content only
 * appears after the JavaScript runs, and the page is never indexed properly.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${BRAND} — Vietnam Tours, Day Trips & Private Experiences`,
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: BRAND,
    url: absoluteUrl("/"),
    title: `${BRAND} — Vietnam Tours, Day Trips & Private Experiences`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND} — Vietnam Tours, Day Trips & Private Experiences`,
    description: SITE_DESCRIPTION,
  },
};

export default async function Home() {
  const [tours, company] = await Promise.all([fetchTours(), fetchCompany()]);

  const jsonLd = buildPublicGraph(company, [buildTourListJsonLd(tours)]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage tours={tours} />
    </>
  );
}
