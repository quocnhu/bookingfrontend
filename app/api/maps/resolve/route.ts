import { type NextRequest } from "next/server";
import { extractCoordsFromUrl, mapEmbedSrc } from "@/lib/map";

export const dynamic = "force-dynamic";

/**
 * Resolves a short Google Maps share link (maps.app.goo.gl / goo.gl/maps)
 * server-side and returns an embeddable map URL, since short links cannot be
 * embedded or resolved from the browser (CORS).
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  if (!raw) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const res = await fetch(raw, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    const finalUrl = res.url || raw;
    const coords = extractCoordsFromUrl(finalUrl);
    if (coords) {
      return Response.json({
        resolved: finalUrl,
        embed: mapEmbedSrc(`${coords[0]},${coords[1]}`),
      });
    }
    return Response.json({ resolved: finalUrl, embed: "" });
  } catch {
    return Response.json({ error: "could not resolve link" }, { status: 422 });
  }
}
