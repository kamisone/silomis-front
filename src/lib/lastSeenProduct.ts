/**
 * The most recently viewed product, kept in the browser.
 *
 * Deliberately local rather than server-backed, unlike the cart and the
 * wishlist: this is a navigation convenience for one browser, not a record the
 * shopper owns and expects to find again on another device. A round-trip would
 * buy nothing and cost a request on every product page.
 *
 * It is treated as strictly functional storage — the same footing as the cart
 * and the wishlist's session token, which also write without a consent gate.
 * Nothing here is shared, sent anywhere, or used to profile anyone; it is the
 * page the shopper just had open, so they can get back to it.
 */

export const LAST_SEEN_KEY = "silomis_last_seen_product";

/**
 * Fired after a write so a card already on screen updates without a reload —
 * `storage` only fires in *other* tabs, so same-tab navigation needs its own
 * signal.
 */
export const LAST_SEEN_EVENT = "silomis:last-seen-product";

export interface LastSeenProduct {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  priceCents: number | null;
  /** Set when the shopper closes the card. Stored on the record itself, so
   *  viewing a different product naturally starts over with a fresh one. */
  dismissed?: boolean;
}

function isProduct(value: unknown): value is LastSeenProduct {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.slug === "string" && typeof v.title === "string";
}

export function readLastSeen(): LastSeenProduct | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isProduct(parsed) ? parsed : null;
  } catch {
    // Private mode, a full quota, or a value from an older shape — behave as if
    // nothing had been seen rather than breaking the page around it.
    return null;
  }
}

function write(product: LastSeenProduct | null): void {
  try {
    if (product) localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(product));
    else localStorage.removeItem(LAST_SEEN_KEY);
  } catch {
    // Storage unavailable — the feature simply does nothing this session.
    return;
  }
  window.dispatchEvent(new Event(LAST_SEEN_EVENT));
}

/**
 * Record a product view.
 *
 * A dismissal sticks to the product it was made on: coming back to the same
 * product does not resurrect a card the shopper has already closed, while
 * viewing a different one does, because that is a new record.
 */
export function rememberLastSeen(product: Omit<LastSeenProduct, "dismissed">): void {
  if (typeof window === "undefined") return;
  const previous = readLastSeen();
  const dismissed = previous?.id === product.id ? previous.dismissed : undefined;
  write({ ...product, ...(dismissed ? { dismissed: true } : {}) });
}

/** Close the card for the product currently stored, keeping the record itself
 *  so the next product viewed still gets a card. */
export function dismissLastSeen(): void {
  if (typeof window === "undefined") return;
  const current = readLastSeen();
  if (current) write({ ...current, dismissed: true });
}
