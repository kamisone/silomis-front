import type { Metadata } from "next";
import CatalogListing, {
  fetchContent,
  type CatalogListingConfig,
  type ListingSearchParams,
} from "@/components/shop/catalog/CatalogListing";
import { isValidLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { localeAlternates } from "@/lib/seo";

/* 120, written out rather than imported from CatalogListing.
   Route segment config has to be a literal Next can read without evaluating
   the module — an imported constant type-checks and then fails the build at
   "Collecting page data" with "Invalid segment configuration export". The
   fetches inside the shared component use the same number via
   LISTING_REVALIDATE; this one has to be here. */
export const revalidate = 120;

const CONFIG: CatalogListingConfig = {
  path: "sale",
  filterParam: "onSale",
  contentSlug: "sale",
  tag: (t) => t.shop.sale,
  breadcrumb: (t) => t.shop.saleBreadcrumb,
  empty: (t) => t.shop.saleEmpty,
};

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ListingSearchParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const content = await fetchContent(CONFIG.contentSlug, locale);
  const title = content?.title?.trim();
  const description = content?.intro?.trim();
  // No built-in copy stands in for either: what the admin left blank stays
  // blank. An omitted title falls through to the root layout's site-wide
  // default, which is the one <title> a page cannot go without.
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    alternates: localeAlternates(locale, "/sale"),
  };
}

export default async function SalePage({ params, searchParams }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  return <CatalogListing locale={locale} searchParams={await searchParams} config={CONFIG} />;
}
