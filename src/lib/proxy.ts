import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ProxyOptions = {
  /** Inject the silomis_auth cookie as Bearer. Default: true */
  auth?: boolean;
  /** Additional headers forwarded verbatim */
  extraHeaders?: Record<string, string>;
  /** Called after a 2xx response. Receives (responseBody, requestBody). */
  onSuccess?: (resBody: unknown, reqBody?: unknown) => void | Promise<void>;
  /** Body returned on network error (502). Default: { error: "backend_unreachable" } */
  errorBody?: Record<string, unknown>;
  /** Set true when the backend may redirect (e.g. a signed-URL fetch). */
  passRedirect?: boolean;
};

function extractBearer(req: NextRequest): Record<string, string> {
  const token = req.cookies.get("silomis_auth")?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Header the backend reads first for the visitor's real address. Nothing
 * between here and the pod rewrites a custom header, unlike the standard
 * `X-Forwarded-*` set, which an ingress will happily replace with its own peer.
 */
const ORIGINAL_CLIENT_IP_HEADER = "x-original-client-ip";

/**
 * Every storefront call reaches the backend through this proxy, so without
 * these the backend only ever sees THIS process — `req.ip` came back as
 * `::ffff:127.0.0.1` for every request, which is why no behaviour event or
 * replay session had a country.
 *
 * The user agent goes with it: it is what classifies device (mobile/desktop)
 * and what the bot filter reads, and it was equally invisible.
 */
function forwardClientIdentity(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const forwarded = req.headers.get("x-forwarded-for");

  // Priority order matters, and the edge header comes first.
  //
  // The edge nginx stamps X-Original-Client-IP with $remote_addr — the address
  // the visitor actually connected from — precisely because the k8s ingress
  // rewrites the standard X-Forwarded-* set with its own peer unless
  // `use-forwarded-headers` is on. By the time a request reaches this process,
  // x-forwarded-for may therefore already say "the ingress" rather than "the
  // visitor". Passing the edge header straight through is what survives that
  // hop; preferring x-forwarded-for here would re-introduce the bug the header
  // exists to route around.
  const clientIp =
    req.headers.get(ORIGINAL_CLIENT_IP_HEADER)?.split(",")[0]?.trim() ||
    forwarded?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim();

  if (clientIp) {
    headers[ORIGINAL_CLIENT_IP_HEADER] = clientIp;
    // Forwarded as received so the chain in front of this process stays intact;
    // the backend's `trust proxy` walks it past the private hops.
    headers["x-forwarded-for"] = forwarded ?? clientIp;
  }

  const userAgent = req.headers.get("user-agent");
  if (userAgent) headers["user-agent"] = userAgent;

  return headers;
}

/**
 * Every admin (and future storefront) API call goes browser → this route →
 * backend, never browser → backend directly. That keeps the JWT in an
 * httpOnly cookie the browser's JS can never read, and gives every route a
 * single place to attach auth, forward query params, and normalize errors.
 */
export async function proxyRequest(req: NextRequest, method: Method, path: string, opts: ProxyOptions = {}): Promise<NextResponse> {
  const { auth = true, extraHeaders = {}, onSuccess, errorBody = { error: "backend_unreachable" }, passRedirect = false } = opts;

  try {
    const authHeaders = auth ? extractBearer(req) : {};
    let fetchBody: BodyInit | undefined;
    let contentTypeHeader: Record<string, string> = {};
    let reqBody: unknown;

    if (method !== "GET" && method !== "DELETE") {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
        fetchBody = await req.formData();
      } else {
        reqBody = await req.json().catch(() => undefined);
        if (reqBody !== undefined) {
          fetchBody = JSON.stringify(reqBody);
          contentTypeHeader = { "Content-Type": "application/json" };
        }
      }
    }

    // Forwarded for every method — query params like ?lang= are just as
    // meaningful on a mutation as on a read.
    let url = `${BACKEND_URL}${path}`;
    const qs = new URL(req.url).searchParams.toString();
    if (qs) url += `?${qs}`;

    const res = await fetch(url, {
      method,
      cache: "no-store",
      headers: { ...forwardClientIdentity(req), ...authHeaders, ...contentTypeHeader, ...extraHeaders },
      ...(fetchBody !== undefined ? { body: fetchBody } : {}),
      ...(passRedirect ? { redirect: "manual" } : {}),
    });

    if (passRedirect) {
      const location = res.headers.get("location");
      if (location) return NextResponse.redirect(location, 302);
    }

    const resCt = res.headers.get("content-type") ?? "";
    if (res.status === 204 || !resCt.includes("application/json")) {
      if (res.ok && onSuccess) await onSuccess(undefined, reqBody);
      return new NextResponse(null, { status: res.status });
    }

    const data: unknown = await res.json();
    if (res.ok && onSuccess) await onSuccess(data, reqBody);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(errorBody, { status: 502 });
  }
}
