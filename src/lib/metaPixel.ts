"use client";

// Meta Pixel browser helpers — plain JS, no React.
//
// Compliance: never add hashed or raw user_data (email/phone/name) to any
// fbq('track', …) call from this file — that's a server-side Conversions API
// concern (see back/src/marketing/meta-capi/). Never pass health, financial,
// or children's data as event parameters, per Meta's Business Tools Terms.
// Callers should only ever pass value/currency/content identifiers.

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string };
    _fbq?: unknown;
  }
}

/** Idempotent — safe to call more than once, only injects the base code the first time. */
export function initFbq(pixelId: string): void {
  if (typeof window === "undefined" || window.fbq) return;

  /* eslint-disable */
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function (...args: unknown[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode?.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq!("init", pixelId);
}

/** No-op if the pixel hasn't been initialized yet (e.g. before consent) — always safe to call. */
export function pixelTrack(eventName: string, params?: Record<string, unknown>, eventId?: string): void {
  if (typeof window === "undefined" || !window.fbq) return;
  if (eventId) {
    window.fbq("track", eventName, params ?? {}, { eventID: eventId });
  } else {
    window.fbq("track", eventName, params ?? {});
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Reads the _fbc (Click ID) / _fbp (Browser ID) cookies the pixel base code sets
 * once loaded — used only for Conversions API match quality (see
 * back/src/marketing/meta-capi/). Both are commonly null: _fbc only exists if the
 * visitor arrived via a Meta ad click; _fbp only exists once the pixel has loaded
 * (i.e. after marketing consent was granted at some point in this browser).
 */
export function getMetaCookies(): { fbc: string | null; fbp: string | null } {
  return { fbc: readCookie("_fbc"), fbp: readCookie("_fbp") };
}

/**
 * Sends the matching server-side (Conversions API) event for view/query-type
 * actions (ViewContent, Search) that have no natural backend mutation to hook
 * into — AddToCart/InitiateCheckout/Purchase are sent from their own backend
 * flows instead. Gated the same way as the browser pixel: only fires once
 * fbq has loaded (i.e. after marketing consent was granted), so a customer
 * who never consents never has this sent server-side either. Fire-and-forget
 * — never blocks the UI, failures are silently swallowed (best-effort
 * analytics, not a user-facing feature).
 */
export function trackServerEvent(eventName: "ViewContent" | "Search", eventId: string, customData: Record<string, unknown>): void {
  if (typeof window === "undefined" || !window.fbq) return;
  const { fbc, fbp } = getMetaCookies();
  fetch("/next-api/public/shop/meta-capi/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName,
      eventId,
      eventSourceUrl: window.location.href,
      customData,
      fbc,
      fbp,
    }),
  }).catch(() => {});
}
