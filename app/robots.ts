import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * robots.txt — the crawl rules for the whole site.
 *
 * The public pages (home, /tours, /tour/*) are open. Everything behind the
 * login (the office dashboard, the bookings, the staff pages) is blocked:
 * those pages must never end up in Google's index, and they would otherwise
 * compete with the public tour pages for the same keywords.
 */
export default function robots(): MetadataRoute.Robots {
  const blocked = [
    "/api/",
    "/dashboard",
    "/manage",
    "/bookings",
    "/users",
    "/audit",
    "/auth-activities",
    "/profile",
    "/company-profile",
    "/drive",
    "/leaves",
    "/notifications",
    "/accounting",
    "/service",
    "/driver",
    "/tour-guide",
    "/transport-provider",
    "/login",
    "/register",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: blocked,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
