import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n";

/**
 * The storefront's public origin, without a trailing slash.
 *
 * Everything canonical/OG/sitemap-related resolves against this, so it must be
 * the address shoppers and crawlers actually use — not the internal API host.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://silomis.com").replace(/\/+$/, "");

export const SITE_NAME = "Silomis";

/** Absolute URL for a site-relative path — sitemap and JSON-LD need real URLs. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Canonical + hreflang for one storefront page, given its locale-less path.
 *
 * Every page exists once per locale at `/{locale}{path}`. Without `languages`
 * a crawler sees seven near-identical pages competing with each other; with it
 * they are one page in seven languages. `x-default` points at the default
 * locale, which is what the middleware sends an undecided visitor to anyway.
 */
export function localeAlternates(locale: Locale, path = "") {
  const clean = path === "/" ? "" : path && !path.startsWith("/") ? `/${path}` : path;
  return {
    canonical: `/${locale}${clean}`,
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, `/${l}${clean}`])),
      "x-default": `/${DEFAULT_LOCALE}${clean}`,
    },
  };
}

/**
 * For pages that are useful to a shopper but worthless in an index: the cart,
 * checkout, the wishlist, order tracking, search results.
 *
 * `follow: true` on purpose — these pages link back into the catalogue, and
 * there is no reason to throw that away just because the page itself should
 * not rank. robots.txt blocks the crawl; this stops a URL that leaks in from
 * being indexed anyway, which robots.txt alone cannot do.
 */
export const NO_INDEX = {
  index: false,
  follow: true,
  googleBot: { index: false, follow: true },
} as const;
