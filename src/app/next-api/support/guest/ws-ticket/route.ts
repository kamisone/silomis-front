import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";
const COOKIE_NAME = "support_token";

// Issues a short-lived signed WebSocket ticket for the guest.
// The raw guest token never leaves the server — only the signed ticket does.
export async function POST(req: NextRequest): Promise<Response> {
  const guestToken = req.cookies.get(COOKIE_NAME)?.value;
  if (!guestToken) return NextResponse.json({ error: "no_token" }, { status: 401 });

  try {
    const res = await fetch(`${BACKEND_URL}/support/guest/ws-ticket`, {
      method: "POST",
      headers: { "x-support-token": guestToken },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "backend_unreachable" }, { status: 502 });
  }
}
