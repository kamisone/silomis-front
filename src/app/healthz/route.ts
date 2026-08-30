import { NextResponse } from "next/server";

/**
 * Kubernetes probe target for the front Deployment.
 *
 * Deliberately NOT under /next-api: those routes go through the auth branch of
 * the middleware, and every other path gets locale-redirected to /{locale}/…,
 * which a probe reads as a failure since a 307 is not a success code.
 * `middleware.ts` short-circuits this path before any of that.
 *
 * It checks nothing but the Next server itself. The storefront degrades rather
 * than dies when the API is unreachable, so failing readiness on a backend
 * blip would take the whole front tier out of the Service for no benefit.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", uptime: Math.floor(process.uptime()) });
}
