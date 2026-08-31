import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ShopListing from "./ShopListing";
import { DEFAULT_LOCALE, getTranslations, isValidLocale, type Locale } from "@/lib/i18n";
import { localeAlternates } from "@/lib/seo";

/**
 * Localised, and canonical to the locale-prefixed path. The bare `/shop` this
 * page is reached through redirects to the home page anyway (see below), so
 * the version worth indexing is always a category view.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = getTranslations(locale).shop;
  return {
    title: t.seoShopTitle,
    description: t.seoShopDescription,
    alternates: localeAlternates(locale, "/shop"),
    openGraph: { title: t.seoShopTitle, description: t.seoShopDescription, type: "website" },
  };
}

/**
 * The category listing.
 *
 * There is deliberately no "all products" view: without a `categoryId` this
 * route has nothing to show that the home page does not show better, so it
 * sends visitors there rather than rendering an undifferentiated list. The
 * route survives because it is the listing engine — categories, its facets and
 * its sidebar all live here. Search has its own page at /shop/search.
 */
export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  if (!sp.categoryId) redirect(`/${locale}`);

  return (
    <Suspense fallback={null}>
      <ShopListing />
    </Suspense>
  );
}
