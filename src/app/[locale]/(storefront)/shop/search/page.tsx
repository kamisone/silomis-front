import { Suspense } from "react";
import type { Metadata } from "next";
import SearchResults from "./SearchResults";
import { DEFAULT_LOCALE, getTranslations, isValidLocale, type Locale } from "@/lib/i18n";
import { NO_INDEX, localeAlternates } from "@/lib/seo";

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Search results are deliberately kept out of the index: the URL space is
 * unbounded, every page is thin, and each one competes with the category
 * listing that should rank for the same words. Links out are still followed.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = getTranslations(locale).shop;
  return {
    title: t.seoSearchTitle,
    description: t.seoSearchDescription,
    robots: NO_INDEX,
    alternates: localeAlternates(locale, "/shop/search"),
  };
}

export default function ShopSearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchResults />
    </Suspense>
  );
}
