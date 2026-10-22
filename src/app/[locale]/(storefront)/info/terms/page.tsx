import type { Metadata } from "next";
import { getSalesPolicies, policyFor } from "@/lib/i18n/salesPolicies";
import PolicyPage from "@/components/legal/PolicyPage";

/**
 * Terms of sale for the neutral pages (see lib/shop/neutralChrome.ts) — the
 * main shop's terms without the embroidery sections. Always shown with the
 * neutral header and footer; kept out of search, where /terms answers.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getSalesPolicies(locale).terms;
  return { title: t.title, robots: { index: false } };
}

export default async function NeutralTermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getSalesPolicies(locale);
  return (
    <>
      <span data-chrome-mark="neutral" hidden />
      <PolicyPage doc={policyFor(t.terms, true)} updated={t.updated} />
    </>
  );
}
