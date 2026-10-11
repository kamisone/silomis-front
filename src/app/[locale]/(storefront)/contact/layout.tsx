import type { Metadata } from "next";
import { getTranslations, isValidLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { localeAlternates } from "@/lib/seo";

/**
 * A layout purely to carry metadata: the contact page is a client component
 * and cannot export it itself. Without this it had no title of its own, no
 * description in its language and no hreflang alternates.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isValidLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = getTranslations(locale).contact;
  return { title: t.title, description: t.sub, alternates: localeAlternates(locale, "/contact") };
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
