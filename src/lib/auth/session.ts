export const ACCESS_COOKIE = "silomis_auth";
export const REFRESH_COOKIE = "silomis_refresh";

// Cookie lifetime mirrors the intended refresh-token TTL (15 days).
// The access token's own `exp` JWT claim governs per-request validity;
// the cookie just needs to outlive the rotating session.
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 15;

export interface RotatedTokens {
  access_token: string;
  refresh_token: string;
}

export interface SessionResult {
  /** A valid (possibly freshly-rotated) access token, or null. */
  accessToken: string | null;
  /** Set when the refresh flow produced new tokens — caller must persist and forward these. */
  rotated?: RotatedTokens;
  /**
   * Backend explicitly rejected both tokens — safe to clear auth cookies.
   * Only set when the backend responded (not when it was unreachable).
   */
  expired?: boolean;
  /**
   * Backend was unreachable (network error / timeout).
   * Caller must NOT clear cookies — the tokens may still be valid once
   * the backend recovers.
   */
  networkError?: boolean;
}

// ── Token validation (backend is the single source of truth) ─────────────

type CheckResult = "valid" | "invalid" | "network_error";

// Every admin navigation resolves its session through this check — middleware
// -> /next-api/auth/session -> here -> backend /auth/me. A short positive-
// result cache keeps the backend as the source of truth (still re-checked at
// least every 30s) while cutting the dominant cost for the common case: an
// admin actively clicking around with a token that's still obviously valid.
// Deliberately caches "valid" only — "invalid" always falls through to the
// refresh-token path.
const VALID_TOKEN_CACHE_TTL_MS = 30_000;
const validTokenCache = new Map<string, number>(); // token -> validUntil epoch ms

function sweepExpiredTokenCacheEntries(now: number): void {
  validTokenCache.forEach((validUntil, token) => {
    if (validUntil <= now) validTokenCache.delete(token);
  });
}

async function checkAccessToken(token: string, backendUrl: string): Promise<CheckResult> {
  const now = Date.now();
  const cachedValidUntil = validTokenCache.get(token);
  if (cachedValidUntil !== undefined && cachedValidUntil > now) return "valid";

  try {
    const res = await fetch(`${backendUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    // Only an explicit auth rejection means the token is bad. A 429 or 5xx
    // says nothing about the token, and reading it as "invalid" sent every
    // backend hiccup down the refresh path.
    if (res.status === 401 || res.status === 403) return "invalid";
    if (!res.ok) return "network_error";

    if (validTokenCache.size > 500) sweepExpiredTokenCacheEntries(now);
    validTokenCache.set(token, now + VALID_TOKEN_CACHE_TTL_MS);
    return "valid";
  } catch {
    return "network_error";
  }
}

export interface RotateResult {
  tokens: RotatedTokens | null;
  networkError: boolean;
}

async function callRefresh(refreshToken: string, backendUrl: string): Promise<RotateResult> {
  try {
    const res = await fetch(`${backendUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    // Only 400/401/403 mean the backend looked at the token and refused it —
    // the one case where the caller may wipe the cookies. A 429 (refresh rate
    // limit) or a 5xx is transient: treating it as a rejection is what logged
    // admins out minutes into a 15-day session.
    if (res.status === 400 || res.status === 401 || res.status === 403) return { tokens: null, networkError: false };
    if (!res.ok) return { tokens: null, networkError: true };
    return { tokens: await res.json(), networkError: false };
  } catch {
    return { tokens: null, networkError: true };
  }
}

// When the access token expires, every request in flight (the page, its RSC
// payload, each parallel /next-api call, every open tab) arrives with the same
// refresh token at once. Without this, each one rotated it separately: N
// backend rotations, N new token families, and N hits on the refresh rate
// limit. Concurrent callers now share one rotation, and callers arriving just
// after it (still carrying the old cookie) get the same result back.
const ROTATION_REUSE_MS = 30_000;
const inFlightRotations = new Map<string, Promise<RotateResult>>();
const recentRotations = new Map<string, { result: RotateResult; until: number }>();

/** Calls the backend's refresh endpoint (rotating the token on success). */
export async function rotateTokens(refreshToken: string, backendUrl: string): Promise<RotateResult> {
  const now = Date.now();
  const recent = recentRotations.get(refreshToken);
  if (recent && recent.until > now) return recent.result;

  const pending = inFlightRotations.get(refreshToken);
  if (pending) return pending;

  const promise = callRefresh(refreshToken, backendUrl).then((result) => {
    inFlightRotations.delete(refreshToken);
    if (result.tokens) {
      if (recentRotations.size > 200) recentRotations.forEach((v, k) => v.until <= now && recentRotations.delete(k));
      recentRotations.set(refreshToken, { result, until: Date.now() + ROTATION_REUSE_MS });
    }
    return result;
  });
  inFlightRotations.set(refreshToken, promise);
  return promise;
}

// ── Session resolution ─────────────────────────────────────────────────

/**
 * Single source of truth for session resolution — every check is delegated
 * to the backend, which owns JWT_SECRET and the refresh-token store.
 *
 * 1. Ask the backend to validate the access token.
 * 2. If invalid (not expired), attempt refresh-token recovery with rotation.
 * 3. A network error at either step sets `networkError` so the caller does
 *    NOT clear cookies — cookies must only be wiped when the backend
 *    explicitly rejects the refresh token (expired/revoked).
 */
export async function resolveSession(
  accessToken: string | undefined,
  refreshToken: string | undefined,
  backendUrl: string,
): Promise<SessionResult> {
  if (accessToken) {
    const check = await checkAccessToken(accessToken, backendUrl);
    if (check === "valid") return { accessToken };
    if (check === "network_error") return { accessToken: null, networkError: true };
    // "invalid" → fall through to refresh
  }

  if (refreshToken) {
    const { tokens, networkError } = await rotateTokens(refreshToken, backendUrl);
    if (tokens) return { accessToken: tokens.access_token, rotated: tokens };
    if (networkError) return { accessToken: null, networkError: true };
  }

  // Backend explicitly rejected both tokens.
  return { accessToken: null, expired: true };
}
