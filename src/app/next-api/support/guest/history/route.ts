import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";
const COOKIE_NAME = "support_token";

export async function GET(req: NextRequest): Promise<Response> {
  const guestToken = req.cookies.get(COOKIE_NAME)?.value;
  if (!guestToken) return NextResponse.json({ messages: [] });

  const since = req.headers.get("x-support-since") ?? undefined;

  try {
    const res = await fetch(`${BACKEND_URL}/support/guest/history`, {
      headers: {
        "x-support-token": guestToken,
        ...(since ? { "x-support-since": since } : {}),
      },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
