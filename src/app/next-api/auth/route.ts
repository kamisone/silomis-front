import { NextRequest, NextResponse } from "next/server";
import { REFRESH_COOKIE } from "@/lib/auth/session";
import { setAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";

const BACKEND_URL = process.env.API_BASE_URL_SERVER || "http://127.0.0.1:4000";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return NextResponse.json({ error: "backend_unreachable" }, { status: 502 });
  }

  if (!res.ok) {
    if (res.status === 429) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const data = await res.json();

  // MFA required — forward the challenge to the browser (see /next-api/auth/mfa).
  if (data.mfaRequired) {
    return NextResponse.json(data, { status: 200 });
  }

  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, data as { access_token: string; refresh_token: string });
  return response;
}

export async function DELETE(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      await fetch(`${BACKEND_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Best-effort revocation — cookies are cleared regardless.
    }
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
