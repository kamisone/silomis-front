import { readShipCountryHint } from "@/lib/shop/shipCountryHint";

/** A method as the checkout's delivery step quotes it. */
export interface QuotedMethod {
  id: string;
  code: string | null;
  name: string;
  carrier: string | null;
  priceCents: number;
  originalPriceCents: number;
  isFree: boolean;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

export interface ProductDeliveryOptions {
  /** The visitor's country when the shop ships there; null = `methods` is every option any shipping country gets. */
  country: string | null;
  freeShipping: boolean;
  methods: QuotedMethod[];
}

// One request per product + price + language, shared by everything on the page
// that asks (the free-shipping banner and the "Delivery details" panel).
const inFlight = new Map<string, Promise<ProductDeliveryOptions>>();

/**
 * What the checkout's delivery step would offer for a basket of just this
 * product, for the visitor's country (checkout hint, else IP — decided by the
 * server). A failed request is forgotten so the next caller retries.
 */
export function fetchProductDeliveryOptions(productId: string, priceCents: number, locale: string): Promise<ProductDeliveryOptions> {
  const qs = new URLSearchParams({ subtotal: String(priceCents), lang: locale });
  const hint = readShipCountryHint();
  if (hint) qs.set("country", hint);
  const url = `/next-api/public/shop/shipping/product/${encodeURIComponent(productId)}?${qs}`;
  let pending = inFlight.get(url);
  if (!pending) {
    pending = fetch(url).then((r) => {
      if (!r.ok) throw new Error("delivery options fetch failed");
      return r.json() as Promise<ProductDeliveryOptions>;
    });
    pending.catch(() => inFlight.delete(url));
    inFlight.set(url, pending);
  }
  return pending;
}
