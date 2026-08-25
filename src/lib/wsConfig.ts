function parseWs(raw: string): { host: string; path: string } {
  const u = new URL(raw);
  const base = u.pathname.replace(/\/$/, "");
  return { host: u.origin, path: `${base}/socket.io` };
}

// The support chat's socket.io client connects straight to the backend, bypassing
// the Next server and its /next-api proxy routes — so it needs the API's real
// public origin, not a relative path.
//
// This is not read at runtime: `env` in next.config.ts inlines the value into the
// client bundle when `next build` runs (webpack DefinePlugin), which is why the
// var needs no NEXT_PUBLIC_ prefix and why setting it in the k8s Deployment does
// nothing. Whatever the *build machine* had is what every visitor downloads.
//
// Must stay a full `process.env.X` member expression — DefinePlugin substitutes
// the text, so destructuring process.env would leave nothing to replace.
const API_BASE_URL = process.env.API_BASE_URL_BROWSER;

// next.config.ts supplies the default; this is only the floor that keeps the URL
// parse total when the build ran with nothing set at all.
export const { host: WS_HOST, path: WS_PATH } = parseWs(API_BASE_URL || "http://localhost:4000");
