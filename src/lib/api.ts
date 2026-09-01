export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API ${status}`);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  // Read the body as text first: a 200 with an empty body is how "nothing is
  // stored here yet" comes back (GET /admin/content/<slug>/<locale> for a
  // locale nobody has saved), and res.json() turns that into an opaque
  // SyntaxError a caller cannot tell apart from a real transport failure.
  const text = await res.text();
  return (text ? (JSON.parse(text) as T) : (undefined as T));
}

export const api = {
  get: <T>(url: string) => request<T>(url, { cache: "no-store" }),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body: unknown) =>
    request<T>(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) => request<T>(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
