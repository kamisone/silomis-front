import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchStoreBrandPage } from "@/lib/shop/storeBrandServer";
import { getStoreBrandCopy } from "@/lib/i18n/storeBrand";
import legal from "../../../privacy-policy/privacy.module.css";
import styles from "../brand.module.css";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const brand = await fetchStoreBrandPage(slug, locale);
  return brand ? { title: brand.aboutTitle || getStoreBrandCopy(locale).about(brand.name) } : {};
}

/** The brand's story, as its admin wrote it. */
export default async function BrandAboutPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const brand = await fetchStoreBrandPage(slug, locale);
  if (!brand?.aboutHtml) notFound();
  return (
    <div className={legal.page}>
      <div className={legal.inner}>
        <h1 className={legal.title}>{brand.aboutTitle || getStoreBrandCopy(locale).about(brand.name)}</h1>
        {/* Admin-authored, like a collection's body. */}
        <div className={styles.richText} dangerouslySetInnerHTML={{ __html: brand.aboutHtml }} />
      </div>
    </div>
  );
}
