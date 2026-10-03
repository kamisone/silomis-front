import { NextRequest, NextResponse } from "next/server";
import { safeMfaError } from "@/lib/auth/mfa-errors";

const BACKEND_URL = process.env.API_BASE_URL_SERVER || "http://127.0.0.1:4000";

/**
 * Sends the one-time code again, optionally by the other method.
 *
 * Separate from the verify route beside it because it sets no cookies and
 * issues no session — it only asks the backend to put another code in front of
 * the person already holding a valid challenge token. The backend decides
 * whether the method is available for that admin and enforces its own send
 * cooldown; this proxy forwards the decision and never widens it.
 *
 * `method` is passed through untouched when present. Omitting it means "the
 * method this admin prefers", which is what the first send used.
 */
export async function POST(request: NextRequest) {
  const { challengeToken, method } = (await request.json()) as {
    challengeToken?: string;
    method?: "email" | "sms";
  };

  if (!challengeToken) {
    return NextResponse.json({ error: "Unable to verify your authentication request." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/auth/mfa/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeToken, ...(method ? { method } : {}) }),
    });
  } catch {
    return NextResponse.json({ error: "Unable to reach the authentication server." }, { status: 502 });
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json({ error: safeMfaError(body, res.status) }, { status: res.status });
  }

  // Only the masked destination comes back out — never the address itself.
  const maskedDestination =
    typeof body === "object" && body !== null
      ? ((body as Record<string, unknown>).maskedDestination as string | undefined)
      : undefined;
  return NextResponse.json({ maskedDestination: maskedDestination ?? "" });
}
