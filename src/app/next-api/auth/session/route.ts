import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";

const BACKEND_URL = process.env.API_BASE_URL_SERVER || "http://127.0.0.1:4000";

/**
 * Node-runtime session resolver, called by middleware (Edge runtime) via a
 * same-origin request. `process.env.API_BASE_URL_SERVER` is read at request
 * time here, unlike in middleware where Next.js inlines `process.env`
 * values at build time.
 */
export async function POST(request: NextRequest) {
  const { access_token, refresh_token } = await request.json();
  const session = await resolveSession(access_token, refresh_token, BACKEND_URL);
  return NextResponse.json(session);
}
