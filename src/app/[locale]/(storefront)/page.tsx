import Link from "next/link";
import { getTranslations, isValidLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import styles from "./page.module.css";

export const metadata = {
  title: "Silomis — Online Shop",
  description: "Shop quality products at Silomis.",
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = getTranslations(locale);

  return (
    <main className={styles.hero}>
      <h1 className={styles.title}>{t.shop.homeTitle}</h1>
      <p className={styles.subtitle}>{t.shop.homeSubtitle}</p>
      <Link href={`/${locale}/shop`} className={styles.cta}>
        {t.shop.homeCta}
      </Link>
    </main>
  );
}
