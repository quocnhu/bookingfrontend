/**
 * Builds a Google Maps embed URL from a map center value.
 * Accepts:
 * - a Google Maps embed <iframe> snippet (the src is used as-is)
 * - "lat,lng" (e.g. "46.5198,6.6323") -> coordinate-centred embed
 * - a place name (e.g. "Lausanne, Switzerland") -> place embed
 * - a Google Maps URL -> extracts the @lat,lng / !3d..!4d.. coordinates and
 *   returns a coordinate-centred embed (short goo.gl/maps.app links are
 *   resolved by the server, see useMapSrc)
 * - empty -> falls back to the fallback query, then to ""
 */

const COORD_EMBED = (lat: number, lng: number) =>
  `https://maps.google.com/maps?q=${lat},${lng}&z=13&output=embed`;

const PLACE_EMBED = (query: string) =>
  `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;

const GMAPS_URL_RE =
  /^https?:\/\/(maps\.app\.goo\.gl\/|goo\.gl\/maps\/|maps\.google\.com\/|www\.google\.com\/maps\/)/i;

const IFRAME_SRC_RE = /<iframe[^>]+src=["']([^"']+)["']/i;

/** True when the input is a Google Maps embed <iframe> snippet. */
export function isEmbedIframe(input: string): boolean {
  return IFRAME_SRC_RE.test(input);
}

/** True when the input is any kind of Google Maps URL. */
export function isGoogleMapsUrl(input: string): boolean {
  return GMAPS_URL_RE.test(input.trim());
}

/** True when the input is a short link that only the server can resolve. */
export function needsResolution(input: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl\/|goo\.gl\/maps\/)/i.test(input.trim());
}

function validCoords(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Extracts lat/lng from a Google Maps URL ("@lat,lng,zoom" or "!3d..!4d.."). */
export function extractCoordsFromUrl(url: string): [number, number] | null {
  const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) {
    const lat = parseFloat(at[1]);
    const lng = parseFloat(at[2]);
    if (validCoords(lat, lng)) return [lat, lng];
  }
  const data = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (data) {
    const lat = parseFloat(data[1]);
    const lng = parseFloat(data[2]);
    if (validCoords(lat, lng)) return [lat, lng];
  }
  return null;
}

export function mapEmbedSrc(
  query?: string | null,
  fallback?: string | null,
): string {
  const raw = (query || fallback || "").trim();
  if (!raw) return "";

  if (isEmbedIframe(raw)) {
    const m = raw.match(IFRAME_SRC_RE);
    return m ? m[1] : "";
  }

  const coords = raw.split(",").map((s) => parseFloat(s.trim()));
  if (
    coords.length === 2 &&
    coords.every((n) => Number.isFinite(n)) &&
    coords[0] >= -90 &&
    coords[0] <= 90 &&
    coords[1] >= -180 &&
    coords[1] <= 180
  ) {
    return COORD_EMBED(coords[0], coords[1]);
  }

  if (isGoogleMapsUrl(raw)) {
    const fromUrl = extractCoordsFromUrl(raw);
    if (fromUrl) return COORD_EMBED(fromUrl[0], fromUrl[1]);
    const q = raw.match(/[?&]q=([^&#]+)/);
    if (q) return PLACE_EMBED(decodeURIComponent(q[1]));
    return "";
  }

  return PLACE_EMBED(raw);
}
