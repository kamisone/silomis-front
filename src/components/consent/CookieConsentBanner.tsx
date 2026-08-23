"use client";

import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import styles from "./CookieConsentBanner.module.css";

interface Props {
  locale: string;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onCustomize: () => void;
}

export default function CookieConsentBanner({
  locale,
  onAcceptAll,
  onRejectAll,
  onCustomize,
}: Props) {
  const t = getTranslations(locale);
  const c = t.consent;

  return (
    <div className={styles.banner} role="region" aria-label="Cookie consent">
      <div className={styles.inner}>
        <div className={styles.textCol}>
          <p className={styles.text}>
            {c.bannerText}{" "}
            <Link href={`/${locale}/cookies`} className={styles.learnMore}>
              {c.learnMore}
            </Link>
          </p>
          <button
            type="button"
            className={styles.rejectLink}
            onClick={onRejectAll}
          >
            {c.rejectAll}
          </button>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={onCustomize}
          >
            {c.customize}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnFilled}`}
            onClick={onAcceptAll}
          >
            {c.acceptAll}
          </button>
        </div>
      </div>
    </div>
  );
}
