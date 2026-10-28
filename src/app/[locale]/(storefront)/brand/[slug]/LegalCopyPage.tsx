import { notFound } from "next/navigation";
import { getStoreBrandCopy } from "@/lib/i18n/storeBrand";
import { LEGAL } from "@/lib/legal-entity";
import { fetchStoreBrandPage, rebrand } from "@/lib/shop/storeBrandServer";
import legal from "../../privacy-policy/privacy.module.css";
import styles from "./brand.module.css";

interface LegalCopy {
  updated: string;
  title: string;
  intro: string;
  sections: { title: string; body: string }[];
}

/**
 * Privacy policy, legal notice and cookie policy under a neutral brand: the
 * shop's own text in the visitor's language, the brand's name where it says
 * Silomis, and who operates it on top. The company, its data controller and
 * its obligations are the same whatever the logo — so is the text.
 */
export default async function LegalCopyPage({ locale, slug, copy, operatedBy = true }: { locale: string; slug: string; copy: LegalCopy; operatedBy?: boolean }) {
  const brand = await fetchStoreBrandPage(slug, locale);
  if (!brand) notFound();
  const r = (text: string) => rebrand(text, brand);
  return (
    <div className={legal.page}>
      <div className={legal.inner}>
        <p className={legal.updated}>{copy.updated}</p>
        <h1 className={legal.title}>{copy.title}</h1>
        {operatedBy && <p className={styles.operatedBy}>{getStoreBrandCopy(locale).operatedBy(brand.name, LEGAL.companyName)}</p>}
        <p className={legal.intro}>{r(copy.intro)}</p>
        {copy.sections.map((sec, i) => (
          <section key={i} className={legal.section}>
            <h2 className={legal.sectionTitle}>{r(sec.title)}</h2>
            <p className={legal.sectionBody}>{r(sec.body)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
