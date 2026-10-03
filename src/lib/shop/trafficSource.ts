/**
 * First-touch acquisition capture: `document.referrer` and `?utm_source=`
 * only mean anything at the visitor's actual landing — a full reload later
 * loses the original referrer, and a later page's own utm_source (or lack of
 * one) must not overwrite the original attribution. Persisted once, like
 * `shop_cart_token`, and resent with every behaviour/replay/cart call; the
 * backend classifies it into a platform label (back/src/common/utils/
 * traffic-source.util.ts), so the known-platform list can change without a
 * frontend redeploy.
 *
 * Captured eagerly from CartProvider's mount (every storefront page) so a
 * landing's `?utm_source=` is read before a client-side navigation drops it.
 */

const TRAFFIC_SOURCE_KEY = "shop_traffic_source";

// Ad click ids, for links that carry one but no utm_source. Facebook's in-app
// browser in particular often sends no referrer at all, leaving fbclid as the
// only trace of where the visitor came from.
const CLICK_ID_SOURCES: Array<[string, string]> = [
  ["fbclid", "facebook"],
  ["ttclid", "tiktok"],
  ["gclid", "google"],
  ["wbraid", "google"],
  ["gbraid", "google"],
];

export interface TrafficSource {
  referrer: string | null;
  utmSource: string | null;
}

const EMPTY: TrafficSource = { referrer: null, utmSource: null };

/** The visitor's own site navigations are not an acquisition channel. */
function externalReferrer(): string | null {
  const ref = document.referrer;
  if (!ref) return null;
  try {
    return new URL(ref).host === window.location.host ? null : ref;
  } catch {
    return null;
  }
}

export function captureTrafficSource(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(TRAFFIC_SOURCE_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const utmSource =
      params.get("utm_source") ?? CLICK_ID_SOURCES.find(([param]) => params.has(param))?.[1] ?? null;
    const referrer = externalReferrer();
    if (!utmSource && !referrer) return;
    localStorage.setItem(TRAFFIC_SOURCE_KEY, JSON.stringify({ referrer, utmSource }));
  } catch {
    // Storage blocked (private mode etc.) — attribution is best-effort.
  }
}

export function getTrafficSource(): TrafficSource {
  if (typeof window === "undefined") return EMPTY;
  captureTrafficSource();
  try {
    const raw = localStorage.getItem(TRAFFIC_SOURCE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return { referrer: parsed.referrer ?? null, utmSource: parsed.utmSource ?? null };
  } catch {
    return EMPTY;
  }
}
