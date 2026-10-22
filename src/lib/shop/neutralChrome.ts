/**
 * The neutral header/footer, for products outside the embroidery range
 * (Product.neutralLayout).
 *
 * A visitor who lands on such a product keeps the simple header and footer
 * through what follows — cart, checkout, order tracking, the legal and
 * contact pages — so an ad for that product never turns into an embroidery
 * shop halfway through the purchase. Remembered in localStorage as the
 * product's slug, which also gives the neutral logo somewhere to go back to.
 *
 * The neutral footer links to /info/contact, /info/terms and /info/returns:
 * neutral versions of those pages, which always show the neutral header (their
 * own marker) — the main shop has /contact, /terms and /returns.
 *
 * Any other page — the home page, a standard product, a collection, search…
 * — is the main shop: it shows the full header and forgets the neutral mode.
 *
 * Both headers and footers are in the page; `<html data-chrome="neutral">`
 * (and a neutral product page's own marker, for the first visit) picks which
 * one CSS shows — see globals.css. An inline script sets the attribute before
 * the first paint (NEUTRAL_CHROME_SCRIPT), so the full header never flashes.
 */

export const NEUTRAL_CHROME_KEY = "silomis:neutral-chrome";

/** Pages that keep the neutral header once a neutral product was visited (path after the locale). */
const FLOW_PREFIXES = ["/shop/cart", "/shop/checkout", "/shop/orders", "/privacy-policy", "/legal", "/cookies", "/contact", "/terms", "/returns", "/info"];

/** /shop/<segment> routes that are not product pages. */
const SHOP_ROUTES = ["cart", "checkout", "collections", "orders", "search", "wishlist"];

export type ChromeForPath = "flow" | "product" | "main";

/** What kind of page `pathname` is, for the neutral header's purposes. */
export function chromeForPath(pathname: string): ChromeForPath {
  const p = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  if (FLOW_PREFIXES.some((f) => p === f || p.startsWith(`${f}/`))) return "flow";
  const product = p.match(/^\/shop\/([^/]+)$/);
  if (product && !SHOP_ROUTES.includes(product[1])) return "product";
  return "main";
}

/** The neutral product the visitor came from, or null. */
export function readNeutralSlug(): string | null {
  try {
    return localStorage.getItem(NEUTRAL_CHROME_KEY) || null;
  } catch {
    return null;
  }
}

/** Turns the neutral header/footer on (`slug`) or off (null), stored and on screen. */
export function setNeutralChrome(slug: string | null): void {
  try {
    if (slug) localStorage.setItem(NEUTRAL_CHROME_KEY, slug);
    else localStorage.removeItem(NEUTRAL_CHROME_KEY);
  } catch {
    // Storage blocked: the page still switches, only the memory is lost.
  }
  if (slug) document.documentElement.dataset.chrome = "neutral";
  else delete document.documentElement.dataset.chrome;
}

/**
 * Runs before the first paint (inline in the storefront layout): the same
 * decision as NeutralChromeController, from the stored slug alone. A product
 * page is neutral here only when it is the stored product; a neutral product
 * visited for the first time is covered by its own marker instead.
 */
export const NEUTRAL_CHROME_SCRIPT = `(function(){try{
var slug=localStorage.getItem(${JSON.stringify(NEUTRAL_CHROME_KEY)});if(!slug)return;
var p=location.pathname.replace(/^\\/[a-z]{2}(?=\\/|$)/,"")||"/";
var flow=${JSON.stringify(FLOW_PREFIXES)}.some(function(f){return p===f||p.indexOf(f+"/")===0});
var m=p.match(/^\\/shop\\/([^/]+)$/);
var product=m&&${JSON.stringify(SHOP_ROUTES)}.indexOf(m[1])<0;
if(flow||(product&&decodeURIComponent(m[1])===slug))document.documentElement.setAttribute("data-chrome","neutral");
}catch(e){}})();`;
