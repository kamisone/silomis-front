/**
 * The neutral brand the visitor is shopping under — a product sold under its
 * own name instead of Silomis (StoreBrand in the backend).
 *
 * It rides on the neutral mode (lib/shop/neutralChrome.ts): set by the brand's
 * product page or one of its own pages, kept through cart, checkout and order
 * tracking, dropped with the neutral mode on any page of the main shop. The
 * storefront's pages are static, so the brand cannot come from the server
 * there; it is kept here, in localStorage, and drawn by client components.
 *
 * Nothing of Silomis may show meanwhile: the inline script marks
 * `<html data-brand>` before the first paint (NEUTRAL_CHROME_SCRIPT), and a
 * brand page's own marker (`data-brand-mark`) does it on a first visit — CSS
 * then hides every `.silomis-mark` (see globals.css) until the brand's logo
 * and name are drawn.
 */
export interface StoreBrandChrome {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  footerText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  hasAbout: boolean;
  hasFaq: boolean;
  homeSlug: string | null;
}

export const STORE_BRAND_KEY = "silomis:neutral-brand";
const CHANGE_EVENT = "silomis:store-brand";

let cachedRaw: string | null = null;
let cachedBrand: StoreBrandChrome | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORE_BRAND_KEY);
  } catch {
    return null;
  }
}

/** The stored brand — the same object for the same stored value, as useSyncExternalStore needs. */
export function readStoreBrand(): StoreBrandChrome | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedBrand = raw ? (JSON.parse(raw) as StoreBrandChrome) : null;
    } catch {
      cachedBrand = null;
    }
  }
  return cachedBrand;
}

/** Stores the brand (or forgets it) and puts it on screen: the html marker, the tab icon. */
export function writeStoreBrand(brand: StoreBrandChrome | null): void {
  try {
    if (brand) localStorage.setItem(STORE_BRAND_KEY, JSON.stringify(brand));
    else localStorage.removeItem(STORE_BRAND_KEY);
  } catch {
    // Storage blocked: this page still shows the brand, the next one cannot.
  }
  const html = document.documentElement;
  if (brand) html.dataset.brand = brand.slug;
  else delete html.dataset.brand;
  swapTabIcon(brand?.iconUrl ?? null);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * The browser tab's icon: the brand's, or back to the shop's. The original
 * href is kept on the element so it can be put back.
 */
function swapTabIcon(iconUrl: string | null): void {
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]')) {
    if (!link.dataset.shopHref) link.dataset.shopHref = link.href;
    link.href = iconUrl ?? link.dataset.shopHref;
  }
}

/**
 * The shop's name in the tab title ("Cart | Silomis") becomes the brand's on
 * pages that do not know the brand themselves — cart, checkout, tracking.
 */
export function brandTabTitle(siteName: string): void {
  const brand = document.documentElement.dataset.brand ? readStoreBrand() : null;
  if (brand && document.title.includes(siteName)) document.title = document.title.split(siteName).join(brand.name);
}

export function subscribeStoreBrand(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORE_BRAND_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The brand shown on this page: stored, and not switched off by a page of the main shop. */
export function storeBrandSnapshot(): StoreBrandChrome | null {
  return document.documentElement.dataset.brand ? readStoreBrand() : null;
}
