import { NextRequest, NextResponse } from "next/server";
import { REFRESH_COOKIE, rotateTokens } from "@/lib/auth/session";
import { setAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";

const BACKEND_URL = process.env.API_BASE_URL_SERVER || "http://127.0.0.1:4000";

/**
 * Client-side refresh fallback used by TokenRefresher when a backend 401
 * isn't explained by an expired access-token JWT (middleware already
 * recovers that case transparently). Rotates the refresh token like every
 * other path: new access + refresh tokens, previous refresh token revoked.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "no_refresh_token" }, { status: 401 });
  }

  const { tokens, networkError } = await rotateTokens(refreshToken, BACKEND_URL);

  if (!tokens) {
    if (networkError) {
      return NextResponse.json({ error: "backend_unreachable" }, { status: 503 });
    }
    const response = NextResponse.json({ error: "refresh_failed" }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, tokens);
  return response;
}
