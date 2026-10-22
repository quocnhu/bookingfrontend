import type { MetadataRoute } from "next";
import { BRAND, SITE_DESCRIPTION } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND} — Vietnam Tours`,
    short_name: BRAND,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#062A30",
    theme_color: "#062A30",
    orientation: "portrait-primary",
    categories: ["travel", "lifestyle"],
  };
}
