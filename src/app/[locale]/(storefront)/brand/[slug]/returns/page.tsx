import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSalesPolicies, policyFor } from "@/lib/i18n/salesPolicies";
import { getStoreBrandCopy } from "@/lib/i18n/storeBrand";
import { fetchStoreBrandPage, rebrandDoc } from "@/lib/shop/storeBrandServer";
import PolicyPage from "@/components/legal/PolicyPage";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getSalesPolicies(locale).returns.title };
}

/**
 * The shop's returns policy, with the brand's own conditions for its product
 * first. Those add to the policy; the 14 days and the legal guarantees below
 * are the law's and stay as they are.
 */
export default async function BrandReturnsPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const brand = await fetchStoreBrandPage(slug, locale);
  if (!brand) notFound();
  const t = getSalesPolicies(locale);
  const doc = rebrandDoc(policyFor(t.returns, true), brand);
  const note = brand.returnsNote?.trim();
  return <PolicyPage doc={note ? { ...doc, sections: [{ title: getStoreBrandCopy(locale).productReturns, body: note }, ...doc.sections] } : doc} updated={t.updated} />;
}
