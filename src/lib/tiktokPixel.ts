"use client";

// TikTok Pixel browser helpers — mirrors metaPixel.ts exactly, same file
// shape, same compliance rule.
//
// Compliance: never add hashed or raw user_data (email/phone/name) to any
// ttq('track', …) call from this file — that's a server-side Events API
// concern (see back/src/marketing/tiktok-events/). Never pass health,
// financial, or children's data as event parameters. Callers should only
// ever pass value/currency/content identifiers.

declare global {
  interface Window {
    ttq?: ((...args: unknown[]) => void) & {
      methods?: string[];
      queue?: unknown[];
      load?: (pixelCode: string) => void;
      page?: () => void;
      track?: (...args: unknown[]) => void;
    };
    TiktokAnalyticsObject?: string;
  }
}

/** Idempotent — safe to call more than once, only injects the base code the first time. */
export function initTtq(pixelCode: string): void {
  if (typeof window === "undefined" || window.ttq) return;

  /* eslint-disable */
  (function (w: any, d: Document, t: string) {
    w.TiktokAnalyticsObject = t;
    var ttq = (w[t] = w[t] || []);
    ttq.methods = [
      "page", "track", "identify", "instances", "debug", "on", "off", "once",
      "ready", "alias", "group", "enableCookie", "disableCookie",
      "holdConsent", "revokeConsent", "grantConsent",
    ];
    ttq.setAndDefer = function (target: any, method: string) {
      target[method] = function (...args: unknown[]) {
        target.push([method, ...args]);
      };
    };
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.load = function (pixelCode: string) {
      var url = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[pixelCode] = [];
      ttq._i[pixelCode]._u = url;
      ttq._t = ttq._t || {};
      ttq._t[pixelCode] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[pixelCode] = {};
      var script = d.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.src = url + "?sdkid=" + pixelCode + "&lib=ttq";
      var first = d.getElementsByTagName("script")[0];
      first.parentNode?.insertBefore(script, first);
    };
  })(window, document, "ttq");
  /* eslint-enable */

  window.ttq!.load!(pixelCode);
  window.ttq!.page!();
}

/** No-op if the pixel hasn't been initialized yet (e.g. before consent) — always safe to call. */
export function ttqTrack(eventName: string, params?: Record<string, unknown>, eventId?: string): void {
  if (typeof window === "undefined" || !window.ttq) return;
  window.ttq.track!(eventName, params ?? {}, eventId ? { event_id: eventId } : undefined);
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Reads the ttclid (Click ID) / _ttp (Browser ID) — used only for Events API
 * match quality (see back/src/marketing/tiktok-events/). _ttp is a cookie the
 * pixel base code sets once loaded, mirroring Meta's _fbp. ttclid has no
 * equivalent auto-set cookie from TikTok's base code, so it's read straight
 * from the URL param TikTok appends to ad-click landings (?ttclid=…) — falls
 * back to a same-named cookie in case some other layer of the stack already
 * persisted it across navigations.
 */
export function getTikTokCookies(): { ttclid: string | null; ttp: string | null } {
  const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ttclid") : null;
  return { ttclid: fromUrl ?? readCookie("ttclid"), ttp: readCookie("_ttp") };
}

/**
 * Sends the matching server-side (Events API) event for view/query-type
 * actions (ViewContent, Search) that have no natural backend mutation to
 * hook into — AddToCart/InitiateCheckout/Purchase are sent from their own
 * backend flows instead. Mirrors trackServerEvent in metaPixel.ts exactly.
 */
export function trackTikTokServerEvent(eventName: "ViewContent" | "Search", eventId: string, properties: Record<string, unknown>): void {
  if (typeof window === "undefined" || !window.ttq) return;
  const { ttclid, ttp } = getTikTokCookies();
  fetch("/next-api/public/shop/tiktok-events/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName,
      eventId,
      eventSourceUrl: window.location.href,
      properties,
      ttclid,
      ttp,
    }),
  }).catch(() => {});
}
