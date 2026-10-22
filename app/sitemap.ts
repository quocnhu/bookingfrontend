import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { fetchTours, tourPath } from "@/lib/server-tours";

/**
 * sitemap.xml — every public page, so Google can find the tours without
 * crawling the whole site.
 *
 * The tour list is fetched when the sitemap is requested, so a new tour is
 * indexed without a redeploy.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tours = await fetchTours();
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/tours"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  for (const tour of tours) {
    pages.push({
      url: absoluteUrl(tourPath(tour)),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return pages;
}
