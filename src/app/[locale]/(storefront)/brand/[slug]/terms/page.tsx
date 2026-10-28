import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSalesPolicies, policyFor } from "@/lib/i18n/salesPolicies";
import { getStoreBrandCopy } from "@/lib/i18n/storeBrand";
import { LEGAL } from "@/lib/legal-entity";
import { fetchStoreBrandPage, rebrandDoc } from "@/lib/shop/storeBrandServer";
import PolicyPage from "@/components/legal/PolicyPage";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getSalesPolicies(locale).terms.title };
}

/** The shop's terms of sale without the embroidery sections — the seller named under the brand. */
export default async function BrandTermsPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const brand = await fetchStoreBrandPage(slug, locale);
  if (!brand) notFound();
  const t = getSalesPolicies(locale);
  const doc = rebrandDoc(policyFor(t.terms, true), brand);
  return <PolicyPage doc={{ ...doc, intro: `${getStoreBrandCopy(locale).operatedBy(brand.name, LEGAL.companyName)} ${doc.intro}` }} updated={t.updated} />;
}
