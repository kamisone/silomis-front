import { headers } from "next/headers";
import NotFoundView from "@/components/NotFoundView";
import { DEFAULT_LOCALE, isValidLocale, type Locale } from "@/lib/i18n";

/**
 * The storefront's 404 boundary. Catches every `notFound()` thrown by a
 * storefront page — a dead product slug, a retired collection, a blog post
 * that was unpublished — as well as any URL under /<locale>/ that matches no
 * route at all, which the sibling `[...notFound]` catch-all funnels here.
 *
 * Because it renders inside the storefront layout, the visitor keeps the
 * header, the category nav, their cart and the footer: the page is a detour,
 * not a dead end.
 *
 * A not-found boundary is handed no params, so the locale comes from the
 * `x-locale` request header the middleware sets.
 */
export default async function StorefrontNotFound() {
  const raw = (await headers()).get("x-locale") ?? DEFAULT_LOCALE;
  const locale: Locale = isValidLocale(raw) ? raw : DEFAULT_LOCALE;

  return <NotFoundView locale={locale} />;
}
