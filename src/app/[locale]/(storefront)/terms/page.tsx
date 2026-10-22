import type { Metadata } from "next";
import { type Locale } from "@/lib/i18n";
import { getSalesPolicies, policyFor } from "@/lib/i18n/salesPolicies";
import { localeAlternates } from "@/lib/seo";
import PolicyPage from "@/components/legal/PolicyPage";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getSalesPolicies(locale).terms;
  return { title: t.title, description: t.intro, alternates: localeAlternates(locale as Locale, "/terms") };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getSalesPolicies(locale);
  return <PolicyPage doc={policyFor(t.terms, false)} updated={t.updated} />;
}
