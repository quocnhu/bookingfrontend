import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  fetchCompany,
  fetchTourCategories,
  fetchTours,
  tourPath,
} from "@/lib/server-tours";
import { buildPublicGraph, buildTourListJsonLd } from "@/lib/seo-jsonld";
import { absoluteUrl, BRAND } from "@/lib/site";
import PublicHeader from "@/components/public-header";
import {
  formatDepartureTime,
  formatTourDuration,
  typeDisplayPrice,
} from "@/lib/tour-display";

/**
 * The public tour listing: /tours
 *
 * A SERVER component — the HTML that Googlebot receives already contains
 * every tour, its duration and its price, and every tour is a real link.
 *
 * Plain HTML on purpose: antd is a client library (its components are
 * "use client" modules), so in a server component the static sub-components
 * (Typography.Title …) are undefined. Semantic HTML is also what a crawler
 * reads best.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vietnam Tours — Day Trips, Cruises & Private Experiences",
  description:
    "Browse every tour: Ha Long Bay cruises, Ninh Binh day trips, Hoi An lantern nights, Da Nang & Ba Na Hills and Ho Chi Minh City. Prices per person, free cancellation.",
  alternates: { canonical: "/tours" },
  openGraph: {
    type: "website",
    siteName: BRAND,
    url: absoluteUrl("/tours"),
    title: `Vietnam Tours | ${BRAND}`,
    description:
      "Ha Long Bay cruises, Ninh Binh day trips, Hoi An lantern nights, Da Nang & Ba Na Hills — book a Vietnam tour online.",
  },
};

const vnd = (value: unknown) =>
  `${Number(value ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} ₫`;

const chipStyle = (active: boolean): CSSProperties => ({
  padding: "6px 14px",
  borderRadius: 999,
  border: `1px solid ${
    active ? "transparent" : "var(--ant-color-border)"
  }`,
  background: active
    ? "var(--ant-color-primary)"
    : "var(--ant-color-bg-container)",
  color: active ? "#fff" : "var(--ant-color-text)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
});

const fromPrice = (tour: {
  adultPrice?: number | string | null;
  typePrices?: {
    type: string;
    adultPrice?: number | string | null;
    childPrice?: number | string | null;
    infantPrice?: number | string | null;
  }[];
}) => {
  const prices = (tour.typePrices ?? [])
    .map((p) => typeDisplayPrice(p))
    .filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : Number(tour.adultPrice ?? 0);
};

export default async function PublicToursPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [tours, categories, company] = await Promise.all([
    fetchTours(),
    fetchTourCategories(),
    fetchCompany(),
  ]);
  const activeCategory =
    category && categories.some((c) => c.slug === category) ? category : null;
  const visibleTours = activeCategory
    ? tours.filter((tour) =>
        (tour.categories ?? []).some(
          (link) => link.category.slug === activeCategory,
        ),
      )
    : tours;

  const jsonLd = buildPublicGraph(company, [buildTourListJsonLd(tours)]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--ant-color-bg-layout)",
        }}
      >
        <PublicHeader />

        <main
          style={{
            width: "100%",
            maxWidth: 1200,
            margin: "0 auto",
            padding: "32px 16px 64px",
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 34,
                lineHeight: 1.2,
                color: "var(--ant-color-text)",
              }}
            >
              Vietnam tours
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                color: "var(--ant-color-text-secondary)",
              }}
            >
              Day trips, cruises and private experiences across Vietnam — book
              directly with a local operator. Free cancellation.
            </p>
          </div>

          {categories.length > 0 && (
            <nav
              aria-label="Tour categories"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <Link href="/tours" style={chipStyle(!activeCategory)}>
                All tours
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/tours?category=${encodeURIComponent(category.slug)}`}
                  style={chipStyle(activeCategory === category.slug)}
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          )}

          {visibleTours.length === 0 ? (
            <p
              style={{
                color: "var(--ant-color-text-secondary)",
                padding: "24px 0",
              }}
            >
              No tours in this category yet.
            </p>
          ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            }}
          >
            {visibleTours.map((tour) => {
              const price = fromPrice(tour);
              return (
                <li key={tour.id}>
                  <Link
                    href={tourPath(tour)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                      borderRadius: 16,
                      overflow: "hidden",
                      border: "1px solid var(--ant-color-border-secondary)",
                      background: "var(--ant-color-bg-container)",
                      color: "inherit",
                    }}
                  >
                    {tour.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tour.thumbnailUrl}
                        alt={`${tour.name} — ${tour.departureLocation ?? "Vietnam"}`}
                        width={640}
                        height={360}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: 180,
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: 180,
                          width: "100%",
                          background:
                            "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(59,130,246,0.15))",
                        }}
                      />
                    )}
                    <div
                      style={{
                        padding: 16,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                          minHeight: 44,
                          alignContent: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            padding: "1px 8px",
                            borderRadius: 999,
                            color: tour.type === "PRIVATE_TOUR" ? "#722ed1" : "#08979c",
                            background:
                              tour.type === "PRIVATE_TOUR"
                                ? "rgba(114, 46, 209, 0.1)"
                                : "rgba(8, 151, 156, 0.1)",
                          }}
                        >
                          {tour.type === "PRIVATE_TOUR" ? "Private" : "Group"}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--ant-color-text-secondary)",
                          }}
                        >
                          {formatTourDuration(tour)} · {tour.code}
                        </span>
                        {(tour.departureTimes ?? []).length > 0 ? (
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--ant-color-text-secondary)",
                            }}
                          >
                            {(tour.departureTimes ?? [])
                              .map((time) => formatDepartureTime(time))
                              .join(" · ")}
                          </span>
                        ) : null}
                      </div>
                      <h2
                        title={tour.name}
                        style={{
                          margin: 0,
                          minHeight: "2.7em",
                          fontSize: 17,
                          lineHeight: 1.35,
                          color: "var(--ant-color-text)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {tour.name}
                      </h2>
                      {tour.departureLocation ? (
                        <span
                          title={tour.departureLocation}
                          style={{
                            display: "block",
                            minHeight: "1.4em",
                            fontSize: 13,
                            lineHeight: 1.4,
                            color: "var(--ant-color-text-secondary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {tour.departureLocation}
                        </span>
                      ) : (
                        <span style={{ display: "block", minHeight: "1.4em" }} />
                      )}
                      <strong
                        style={{
                          marginTop: "auto",
                          paddingTop: 4,
                          minHeight: 24,
                          fontSize: 16,
                          lineHeight: 1.4,
                          whiteSpace: "nowrap",
                        }}
                      >
                        From {vnd(price)} / person
                      </strong>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          )}
        </main>

        <footer
          style={{
            padding: 24,
            borderTop: "1px solid var(--ant-color-border-secondary)",
            textAlign: "center",
            color: "var(--ant-color-text-secondary)",
            fontSize: 12,
          }}
        >
          © {new Date().getFullYear()} {company.name || BRAND}
          {company.address ? ` · ${company.address}` : ""}
          {company.phone ? ` · ${company.phone}` : ""}
        </footer>
      </div>
    </>
  );
}
