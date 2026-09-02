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

/**
 * The catalogue filtered to the products carrying the New badge — the same
 * flag an admin sets per product, read as a listing.
 *
 * Everything else is /sale: same grid, sorts, price filter and admin-managed
 * copy, all of it in CatalogListing. Only these six lines differ.
 */
const CONFIG: CatalogListingConfig = {
  path: "new",
  filterParam: "isNew",
  contentSlug: "new",
  tag: (t) => t.shop.newBadge,
  breadcrumb: (t) => t.shop.newBreadcrumb,
  empty: (t) => t.shop.newEmpty,
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
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    alternates: localeAlternates(locale, "/new"),
  };
}

export default async function NewArrivalsPage({ params, searchParams }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  return <CatalogListing locale={locale} searchParams={await searchParams} config={CONFIG} />;
}
