import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchStoreBrandPage } from "@/lib/shop/storeBrandServer";
import { getStoreBrandCopy } from "@/lib/i18n/storeBrand";
import legal from "../../../privacy-policy/privacy.module.css";
import styles from "../brand.module.css";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getStoreBrandCopy(locale).faqTitle };
}

/** The brand's questions and answers — plain <details>, readable without script. */
export default async function BrandFaqPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const brand = await fetchStoreBrandPage(slug, locale);
  if (!brand?.faqs.length) notFound();
  return (
    <div className={legal.page}>
      <div className={legal.inner}>
        <h1 className={legal.title}>{getStoreBrandCopy(locale).faqTitle}</h1>
        <div className={styles.faqList}>
          {brand.faqs.map((f) => (
            <details key={f.id} className={styles.faqItem}>
              <summary>{f.question}</summary>
              <p className={styles.faqAnswer}>{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
