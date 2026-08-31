import type { Metadata } from "next";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./privacy.module.css";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getTranslations(locale).privacy;
  return { title: t.title, description: t.intro, alternates: localeAlternates(locale as Locale, "/privacy-policy") };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getTranslations(locale).privacy;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.updated}>{t.updated}</p>
        <h1 className={styles.title}>{t.title}</h1>
        <p className={styles.intro}>{t.intro}</p>
        {t.sections.map((sec, i) => (
          <section key={i} className={styles.section}>
            <h2 className={styles.sectionTitle}>{sec.title}</h2>
            <p className={styles.sectionBody}>{sec.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
