import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandChromeMark } from "@/components/layout/NeutralChrome";
import { chromeOf, fetchStoreBrandPage } from "@/lib/shop/storeBrandServer";

type Params = Promise<{ locale: string; slug: string }>;

/**
 * The pages of a neutral brand — a product sold under its own name instead of
 * Silomis (StoreBrand). New pages rather than conditions in the main ones:
 * About, FAQ and Contact are the brand's own copy; Terms, Returns, Privacy,
 * Legal notice and Cookies are the shop's, said under the brand's name.
 *
 * Kept out of search: they exist for the brand's customers, linked from its
 * footer, and the shop's own versions answer for the company.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const brand = await fetchStoreBrandPage(slug, locale);
  if (!brand) return {};
  return {
    title: { default: brand.seoTitle || brand.name, template: `%s | ${brand.name}` },
    description: brand.seoDescription ?? undefined,
    applicationName: brand.name,
    icons: brand.iconUrl ? { icon: brand.iconUrl, apple: brand.iconUrl } : undefined,
    openGraph: { siteName: brand.name, images: brand.shareImageUrl ? [{ url: brand.shareImageUrl }] : undefined },
    robots: { index: false },
  };
}

export default async function StoreBrandLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { locale, slug } = await params;
  const brand = await fetchStoreBrandPage(slug, locale);
  if (!brand) notFound();
  return (
    <>
      <BrandChromeMark brand={chromeOf(brand)} />
      {children}
    </>
  );
}
