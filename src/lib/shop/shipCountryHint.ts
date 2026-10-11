/**
 * The delivery country the visitor picked at checkout, remembered so the
 * header's shipping strip names it instead of guessing from their IP — the
 * address they typed beats any geolocation (VPNs, travel, border regions).
 *
 * localStorage, not the checkout's per-cart sessionStorage: the strip is on
 * every page and should keep the answer after the order is placed.
 */

const KEY = "silomis:ship-country";

/** Fired on this tab when the hint changes; other tabs get the `storage` event. */
export const SHIP_COUNTRY_EVENT = "silomis:ship-country";

export function readShipCountryHint(): string | null {
  try {
    const value = localStorage.getItem(KEY);
    return value && /^[A-Z]{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeShipCountryHint(isoCode: string): void {
  if (!/^[A-Z]{2}$/.test(isoCode)) return;
  try {
    if (localStorage.getItem(KEY) === isoCode) return;
    localStorage.setItem(KEY, isoCode);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(SHIP_COUNTRY_EVENT));
}

/** Calls `onChange` whenever the hint changes, in this tab or another. Returns the unsubscribe. */
export function subscribeShipCountryHint(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(SHIP_COUNTRY_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SHIP_COUNTRY_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
