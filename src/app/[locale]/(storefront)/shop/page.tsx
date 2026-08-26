import { Suspense } from "react";
import { redirect } from "next/navigation";
import ShopListing from "./ShopListing";

export const metadata = {
  title: "Shop — Silomis",
  description: "Browse products at Silomis.",
};

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
