import type { Metadata } from "next";
import { getSalesPolicies, policyFor } from "@/lib/i18n/salesPolicies";
import PolicyPage from "@/components/legal/PolicyPage";

/**
 * Returns & refunds for the neutral pages (see lib/shop/neutralChrome.ts) —
 * the main shop's policy without the personalised-items exception, which
 * never concerns these products. Always neutral; kept out of search.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getSalesPolicies(locale).returns;
  return { title: t.title, robots: { index: false } };
}

export default async function NeutralReturnsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getSalesPolicies(locale);
  return (
    <>
      <span data-chrome-mark="neutral" hidden />
      <PolicyPage doc={policyFor(t.returns, true)} updated={t.updated} />
    </>
  );
}
