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
      headers: { ...authHeaders, ...contentTypeHeader, ...extraHeaders },
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
