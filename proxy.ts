import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACCESS_TOKEN_COOKIE = "booking_access_token";
const REFRESH_TOKEN_COOKIE = "booking_refresh_token";

const PROTECTED_PREFIXES = [
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
];

const AUTH_PATHS = ["/login", "/register"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isTokenFresh(token?: string): boolean {
  if (!token) return false;
  const payload = token.split(".")[1];
  if (!payload) return false;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded)) as { exp?: number };
    return typeof decoded.exp === "number" && decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession =
    isTokenFresh(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value) ||
    isTokenFresh(request.cookies.get(REFRESH_TOKEN_COOKIE)?.value);

  if (isProtected(pathname) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (AUTH_PATHS.includes(pathname) && hasSession) {
    const url = request.nextUrl.clone();
    const redirect = url.searchParams.get("redirect");
    if (redirect && redirect.startsWith("/")) {
      url.pathname = redirect;
    } else {
      url.pathname = "/dashboard";
    }
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
