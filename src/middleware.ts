import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, type SessionResult } from "@/lib/auth/session";
import { resolveSessionFromOrigin } from "@/lib/auth/middleware-session";
import { setAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

function detectLocale(request: NextRequest): Locale {
  const saved = request.cookies.get("silomis_locale")?.value as Locale | undefined;
  if (saved && LOCALES.includes(saved)) return saved;
  const lang = (request.headers.get("accept-language") ?? "").toLowerCase();
  const detected = LOCALES.find((l) => l !== DEFAULT_LOCALE && (lang.startsWith(l) || lang.includes(`,${l}`)));
  return detected ?? DEFAULT_LOCALE;
}

/**
 * Resolves the admin session for this request. If refresh-token rotation
 * happened, the new tokens are written into `request.cookies` so downstream
 * handlers see the fresh access token for *this* request — the response
 * cookies are applied separately via `applySessionCookies` so the browser
 * gets them too.
 */
async function resolveAndPropagate(request: NextRequest): Promise<SessionResult> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const session = await resolveSessionFromOrigin(accessToken, refreshToken, request.nextUrl.origin);

  if (session.rotated) {
    request.cookies.set(ACCESS_COOKIE, session.rotated.access_token);
    request.cookies.set(REFRESH_COOKIE, session.rotated.refresh_token);
  }

  return session;
}

function applySessionCookies(response: NextResponse, session: SessionResult): NextResponse {
  if (session.rotated) setAuthCookies(response, session.rotated);
  else if (session.expired) clearAuthCookies(response);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Kubernetes probes ────────────────────────────────────────────────
  // Must bypass everything below: the locale branch would answer a probe
  // with a 307 to /en/healthz, which the kubelet counts as a failed check.
  if (pathname === "/healthz") return NextResponse.next();

  // ── API routes ──────────────────────────────────────────────────────
  if (pathname.startsWith("/next-api/")) {
    if (pathname.startsWith("/next-api/public/")) return NextResponse.next();
    // Auth endpoints must stay reachable without a valid session.
    if (pathname.startsWith("/next-api/auth")) return NextResponse.next();
    // Guest support chat — authenticated via its own support_token cookie, not the admin session.
    if (pathname.startsWith("/next-api/support/guest/")) return NextResponse.next();
    // Public contact form — anonymous storefront visitors, no admin session exists.
    if (pathname === "/next-api/contacts") return NextResponse.next();

    const session = await resolveAndPropagate(request);
    if (!session.accessToken) {
      return applySessionCookies(NextResponse.json({ error: "unauthorized" }, { status: 401 }), session);
    }
    return applySessionCookies(NextResponse.next({ request: { headers: request.headers } }), session);
  }

  // ── Admin pages: require a session, recovering via refresh if needed ──
  if (pathname.startsWith("/admin")) {
    const session = await resolveAndPropagate(request);
    if (!session.accessToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return applySessionCookies(NextResponse.redirect(loginUrl), session);
    }
    return applySessionCookies(NextResponse.next({ request: { headers: request.headers } }), session);
  }

  // ── Login page: an admin with a recoverable session must never see it ──
  if (pathname === "/login") {
    const session = await resolveAndPropagate(request);
    if (session.accessToken) {
      const fromParam = request.nextUrl.searchParams.get("from");
      const target = fromParam && fromParam.startsWith("/") && !fromParam.startsWith("//") ? fromParam : "/admin";
      return applySessionCookies(NextResponse.redirect(new URL(target, request.url)), session);
    }
    return applySessionCookies(NextResponse.next(), session);
  }

  // ── Storefront pages: locale routing ──────────────────────────────────
  // Everything else (the public shop + home page) is locale-prefixed —
  // admin and login deliberately stay English-only, matching the reference.
  const pathnameHasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));

  if (!pathnameHasLocale) {
    const locale = detectLocale(request);
    const target = new URL(`/${locale}${pathname === "/" ? "" : pathname}`, request.url);
    target.search = request.nextUrl.search;
    const res = NextResponse.redirect(target);
    res.headers.set("x-locale", locale);
    return res;
  }

  const locale = pathname.split("/")[1] as Locale;
  const res = NextResponse.next();
  res.headers.set("x-locale", locale);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|.*\\..*).*)"],
};
