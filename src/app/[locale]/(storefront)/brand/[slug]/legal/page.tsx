import type { Metadata } from "next";
import { getTranslations } from "@/lib/i18n";
import LegalCopyPage from "../LegalCopyPage";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getTranslations(locale).legal.title };
}

/** Its first section already says who operates the brand. */
export default async function BrandLegalPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  return <LegalCopyPage locale={locale} slug={slug} copy={getTranslations(locale).legal} operatedBy={false} />;
}
