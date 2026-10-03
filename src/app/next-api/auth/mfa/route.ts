import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth/cookies";
// Shared with the send route beside this one, so the two cannot describe the
// same failure differently.
import { safeMfaError } from "@/lib/auth/mfa-errors";

const BACKEND_URL = process.env.API_BASE_URL_SERVER || "http://127.0.0.1:4000";


/** POST — verify OTP and set auth cookies */
export async function POST(request: NextRequest) {
  const { challengeToken, otp } = await request.json();

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/auth/mfa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeToken, otp }),
    });
  } catch {
    return NextResponse.json({ error: "Unable to reach the authentication server." }, { status: 502 });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return NextResponse.json({ error: safeMfaError(body, res.status) }, { status: res.status });
  }

  const { access_token, refresh_token } = await res.json();
  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, { access_token, refresh_token });

  return response;
}

/** PUT — resend OTP (or switch method) */
export async function PUT(request: NextRequest) {
  const body = await request.json();

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/auth/mfa/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "Unable to reach the authentication server." }, { status: 502 });
  }

  if (!res.ok) {
    const resBody = await res.json().catch(() => ({}));
    return NextResponse.json({ error: safeMfaError(resBody, res.status) }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ maskedDestination: data.maskedDestination });
}
