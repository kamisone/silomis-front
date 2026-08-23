import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth/cookies";

const BACKEND_URL = process.env.API_BASE_URL_SERVER || "http://127.0.0.1:4000";

// Machine-readable codes from the backend mapped to safe user-facing messages.
// Nothing from the backend's raw `message` field is ever forwarded to the browser.
const ERROR_MESSAGES: Record<string, string> = {
  otp_expired: "Verification code expired. Request a new one.",
  otp_invalid: "Invalid code. Check the digits and try again.",
  challenge_invalid: "Unable to verify your authentication request.",
  rate_limited: "Too many attempts. Please wait a few minutes.",
  cooldown: "Please wait before requesting another code.",
  method_unavailable: "This verification method is not available for your account.",
};

function safeError(body: unknown, status: number): string {
  const code = typeof body === "object" && body !== null ? (body as Record<string, unknown>).code as string | undefined : undefined;
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (status === 429) return ERROR_MESSAGES.rate_limited;
  if (status === 401) return ERROR_MESSAGES.challenge_invalid;
  return "Authentication failed. Please try again.";
}

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
    return NextResponse.json({ error: safeError(body, res.status) }, { status: res.status });
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
    return NextResponse.json({ error: safeError(resBody, res.status) }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ maskedDestination: data.maskedDestination });
}
