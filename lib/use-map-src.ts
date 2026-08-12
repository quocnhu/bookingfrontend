"use client";

import { useEffect, useState } from "react";
import { mapEmbedSrc, needsResolution } from "@/lib/map";

/**
 * Like mapEmbedSrc, but resolves short Google Maps share links
 * (maps.app.goo.gl / goo.gl/maps) through the server first.
 */
export function useMapSrc(
  query?: string | null,
  fallback?: string | null,
): string {
  const [src, setSrc] = useState<string>(() => {
    const raw = (query || fallback || "").trim();
    return needsResolution(raw) ? "" : mapEmbedSrc(query, fallback);
  });

  useEffect(() => {
    const raw = (query || fallback || "").trim();
    if (!needsResolution(raw)) {
      setSrc(mapEmbedSrc(query, fallback));
      return;
    }

    let cancelled = false;
    fetch(`/api/maps/resolve?url=${encodeURIComponent(raw)}`)
      .then((r) => r.json())
      .then((data: { embed?: string }) => {
        if (!cancelled) setSrc(data.embed || "");
      })
      .catch(() => {
        if (!cancelled) setSrc("");
      });
    return () => {
      cancelled = true;
    };
  }, [query, fallback]);

  return src;
}
