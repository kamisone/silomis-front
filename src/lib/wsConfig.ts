function parseWs(raw: string): { host: string; path: string } {
  const u = new URL(raw);
  const base = u.pathname.replace(/\/$/, "");
  return { host: u.origin, path: `${base}/socket.io` };
}

// NEXT_PUBLIC_-prefixed so this is actually inlined into the browser bundle —
// see the .env comment next to NEXT_PUBLIC_API_BASE_URL_BROWSER.
export const { host: WS_HOST, path: WS_PATH } = parseWs(process.env.NEXT_PUBLIC_API_BASE_URL_BROWSER ?? "http://localhost:4000");
