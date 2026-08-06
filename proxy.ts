import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "booking_access_token";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/tours",
  "/bookings",
  "/users",
  "/audit",
  "/profile",
  "/settlements",
];

const AUTH_PATHS = ["/login", "/register"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);

  if (isProtected(pathname) && !hasToken) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PATHS.includes(pathname) && hasToken) {
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
