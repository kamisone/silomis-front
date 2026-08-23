import type { SessionResult } from "./session";

/**
 * Edge-safe session resolution for middleware. Middleware must NOT call
 * `API_BASE_URL_SERVER`-based helpers directly: Next.js inlines
 * `process.env` references in the Edge bundle at *build time*, while route
 * handlers read them at *request time* from the runtime environment. If the
 * two differ, middleware ends up calling the wrong/unreachable backend URL,
 * every session resolution fails, and valid sessions get wiped.
 *
 * Instead, middleware delegates to a same-origin Node route handler using
 * `request.nextUrl.origin`, which is always correct regardless of build vs.
 * runtime env wiring.
 */
export async function resolveSessionFromOrigin(
  accessToken: string | undefined,
  refreshToken: string | undefined,
  origin: string,
): Promise<SessionResult> {
  const controller = new AbortController();
  // 5-second ceiling: if the session route is slow/hung, fail fast without
  // wiping cookies — the user resumes their session on the next request.
  const timer = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(`${origin}/next-api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);

    // A non-2xx response means the session route itself errored, NOT that
    // the backend explicitly rejected the tokens. Treat it as transient.
    if (!res.ok) return { accessToken: null, networkError: true };

    return (await res.json()) as SessionResult;
  } catch {
    clearTimeout(timer);
    return { accessToken: null, networkError: true };
  }
}
