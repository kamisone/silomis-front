import type { Metadata } from "next";
import { Search, CheckCircle, Phone, Truck, type LucideIcon } from "lucide-react";
import { getTranslations } from "@/lib/i18n";
import styles from "./about.module.css";

const VALUE_ICONS: Record<string, LucideIcon> = {
  search: Search,
  "check-circle": CheckCircle,
  phone: Phone,
  truck: Truck,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getTranslations(locale).about;
  return { title: `${t.title} — Silomis`, description: t.mission };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getTranslations(locale);
  const a = t.about;

  return (
    <div className={styles.page}>

      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true">
          <div className={styles.heroBgGlow} />
          <div className={styles.heroBgGlowWhite} />
          <div className={styles.heroBgGrid} />
        </div>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>{a.title}</h1>
          <p className={styles.heroMission}>{a.mission}</p>
        </div>
      </section>

      <div className={styles.content}>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{a.storyLabel}</h2>
          <p className={styles.sectionBody}>{a.story}</p>
        </section>

        <section className={styles.valuesSection}>
          <h2 className={styles.sectionTitle}>{a.valuesLabel}</h2>
          <div className={styles.valuesGrid}>
            {a.values.map(v => {
              const Icon = VALUE_ICONS[v.icon] ?? CheckCircle;
              return (
                <div key={v.title} className={styles.valueCard}>
                  <Icon className={styles.valueIcon} aria-hidden="true" />
                  <h3 className={styles.valueTitle}>{v.title}</h3>
                  <p className={styles.valueBody}>{v.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.ctaSection}>
          <h2 className={styles.ctaTitle}>{a.contactLabel}</h2>
          <p className={styles.ctaBody}>{a.contactBody}</p>
          <a href={`mailto:${t.footer.emailLabel}`} className={styles.ctaBtn}>
            {a.contactCta}
          </a>
        </section>

      </div>
    </div>
  );
}
