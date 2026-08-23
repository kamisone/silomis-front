import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";
const COOKIE_NAME = "support_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export async function POST(req: NextRequest): Promise<Response> {
  // Read or generate the guest token server-side — never expose it to browser JS
  let guestToken = req.cookies.get(COOKIE_NAME)?.value;
  const isNew = !guestToken || !/^[0-9a-f-]{36}$/i.test(guestToken);
  if (isNew) guestToken = crypto.randomUUID();

  let data: unknown = {};
  let status = 200;

  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${BACKEND_URL}/support/guest/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-support-token": guestToken! },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    data = await res.json().catch(() => ({}));
    status = res.status;
  } catch {
    return NextResponse.json({ error: "backend_unreachable" }, { status: 502 });
  }

  const response = NextResponse.json(data, { status });

  // Set/refresh httpOnly cookie — browser JS cannot read this
  response.cookies.set(COOKIE_NAME, guestToken!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}
