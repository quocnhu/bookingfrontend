/**
 * The server-side HTML sanitizer.
 *
 * The tour content (overview, itinerary, regulations…) is stored as HTML and
 * is injected with `dangerouslySetInnerHTML`. It used to be cleaned by
 * DOMPurify in the browser, but the public pages are now rendered on the
 * SERVER (so Google can read them) and DOMPurify needs a browser DOM.
 *
 * This is an allowlist sanitizer: every tag and every attribute that is not
 * explicitly allowed is removed, and the elements that can execute code
 * (script, style, iframe…) are dropped together with their content.
 */

/** The elements that are removed together with their content. */
const DROP_WITH_CONTENT = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "select",
  "option",
  "textarea",
  "svg",
  "math",
  "noscript",
  "template",
  "link",
  "meta",
  "base",
];

/** The elements that survive — everything else is unwrapped (text kept). */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "b",
  "i",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "code",
  "pre",
  "a",
  "img",
  "span",
  "div",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "hr",
  "small",
  "sup",
  "sub",
]);

/** The attributes that survive on an allowed element. */
const ALLOWED_ATTRS = new Set([
  "href",
  "src",
  "alt",
  "title",
  "class",
  "style",
  "target",
  "rel",
]);

/** The URL schemes a link or an image may use. */
const SAFE_URL = /^(https?:|mailto:|tel:)/i;

/** A relative URL (no scheme) is safe. */
const isRelativeUrl = (value: string) =>
  !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith("//");

const escapeAttr = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const safeUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (SAFE_URL.test(trimmed)) return trimmed;
  if (isRelativeUrl(trimmed)) return trimmed;
  return null;
};

const safeStyle = (value: string): string | null => {
  // No script-capable CSS (expression()) and no javascript: in a url().
  if (/expression\s*\(|javascript\s*:|behaviou?r\s*:/i.test(value)) return null;
  return value;
};

/** Clean the attributes of one element. */
function cleanAttributes(raw: string): string {
  const attrRe =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;

  const kept: string[] = [];
  let hasBlank = false;
  let match: RegExpExecArray | null;

  while ((match = attrRe.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    if (!ALLOWED_ATTRS.has(name)) continue;
    // An event handler never survives, even if it slips past the allowlist.
    if (name.startsWith("on")) continue;

    if (name === "href" || name === "src") {
      const url = safeUrl(value);
      if (!url) continue;
      kept.push(`${name}="${escapeAttr(url)}"`);
      continue;
    }

    if (name === "style") {
      const style = safeStyle(value);
      if (!style) continue;
      kept.push(`style="${escapeAttr(style)}"`);
      continue;
    }

    if (name === "target") {
      if (value.toLowerCase() !== "_blank") continue;
      kept.push('target="_blank"');
      hasBlank = true;
      continue;
    }

    kept.push(`${name}="${escapeAttr(value)}"`);
  }

  // A link that opens a new tab must not hand the opener over to it.
  if (hasBlank && !kept.some((a) => a.startsWith("rel="))) {
    kept.push('rel="noopener noreferrer"');
  }

  return kept.length ? ` ${kept.join(" ")}` : "";
}

/** The HTML sanitizer used on the server. */
export function sanitizeHtmlServer(html: string): string {
  if (!html) return "";

  let out = html;

  // 1. the elements that can execute code go away with their content
  for (const tag of DROP_WITH_CONTENT) {
    out = out.replace(
      new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"),
      "",
    );
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }

  // 2. the comments go away (conditional comments are executable in old IE)
  out = out.replace(/<!--[\s\S]*?-->/g, "");

  // 3. every remaining tag is checked against the allowlist
  out = out.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g,
    (match, closing: string, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (closing) return `</${tag}>`;

      const attrs = cleanAttributes(rawAttrs ?? "");
      // A void element never gets a closing tag
      if (["br", "hr", "img"].includes(tag)) return `<${tag}${attrs}>`;
      return `<${tag}${attrs}>`;
    },
  );

  return out;
}

/** The HTML fields of a tour that must be cleaned before they are rendered. */
export const TOUR_HTML_FIELDS = [
  "overview",
  "highlights",
  "regulations",
  "insurancePolicy",
  "includedServices",
  "excludedServices",
  "childrenPolicy",
] as const;

/**
 * Clean every HTML field of a tour (and of its itinerary) before it is
 * rendered. The result is what the client component injects — it never
 * sanitizes again, because DOMPurify needs a browser DOM.
 */
export function sanitizeTourHtml<T extends {
  overview?: string | null;
  highlights?: string | null;
  regulations?: string | null;
  insurancePolicy?: string | null;
  includedServices?: string | null;
  excludedServices?: string | null;
  childrenPolicy?: string | null;
  itineraries?: { description?: string | null }[] | null;
}>(tour: T): T {
  const clean = {
    ...tour,
    overview: tour.overview ? sanitizeHtmlServer(tour.overview) : tour.overview,
    highlights: tour.highlights
      ? sanitizeHtmlServer(tour.highlights)
      : tour.highlights,
    regulations: tour.regulations
      ? sanitizeHtmlServer(tour.regulations)
      : tour.regulations,
    insurancePolicy: tour.insurancePolicy
      ? sanitizeHtmlServer(tour.insurancePolicy)
      : tour.insurancePolicy,
    includedServices: tour.includedServices
      ? sanitizeHtmlServer(tour.includedServices)
      : tour.includedServices,
    excludedServices: tour.excludedServices
      ? sanitizeHtmlServer(tour.excludedServices)
      : tour.excludedServices,
    childrenPolicy: tour.childrenPolicy
      ? sanitizeHtmlServer(tour.childrenPolicy)
      : tour.childrenPolicy,
  };

  if (Array.isArray(tour.itineraries)) {
    clean.itineraries = tour.itineraries.map((it) => ({
      ...it,
      description: it.description
        ? sanitizeHtmlServer(it.description)
        : it.description,
    }));
  }

  return clean as T;
}
