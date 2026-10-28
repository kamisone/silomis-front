import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSalesPolicies } from "@/lib/i18n/salesPolicies";
import { fetchStoreBrandPage } from "@/lib/shop/storeBrandServer";
import NeutralContactForm from "@/components/contact/NeutralContactForm";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getSalesPolicies(locale).neutralContact.title };
}

/** The neutral contact form, in the brand's words and pointing at its legal pages. */
export default async function BrandContactPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const brand = await fetchStoreBrandPage(slug, locale);
  if (!brand) notFound();
  const base = `/${locale}/brand/${encodeURIComponent(brand.slug)}`;
  return <NeutralContactForm intro={brand.contactIntro} termsHref={`${base}/legal`} privacyHref={`${base}/privacy`} brandName={brand.name} />;
}
