import type { Metadata } from "next";
import { isValidLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { getSalesPolicies } from "@/lib/i18n/salesPolicies";

/** Metadata for the neutral contact page (a client component). Kept out of search, where /contact answers. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isValidLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = getSalesPolicies(locale).neutralContact;
  return { title: t.title, description: t.sub, robots: { index: false } };
}

export default function NeutralContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span data-chrome-mark="neutral" hidden />
      {children}
    </>
  );
}
