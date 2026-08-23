"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { getTranslations } from "@/lib/i18n";
import styles from "./CookiePreferencesModal.module.css";

interface Props {
  locale: string;
  initialPrefs: { analytics: boolean; marketing: boolean };
  onSave: (prefs: { analytics: boolean; marketing: boolean }) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose: () => void;
}

export default function CookiePreferencesModal({
  locale,
  initialPrefs,
  onSave,
  onAcceptAll,
  onRejectAll,
  onClose,
}: Props) {
  const t = getTranslations(locale);
  const c = t.consent;

  const [analytics, setAnalytics] = useState(initialPrefs.analytics);
  const [marketing, setMarketing] = useState(initialPrefs.marketing);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={c.modalTitle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>{c.modalTitle}</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <p className={styles.desc}>{c.modalDesc}</p>

        {/* Category rows */}
        <div className={styles.categories}>
          {/* Essential — locked */}
          <div className={styles.row}>
            <div className={styles.rowInfo}>
              <span className={styles.rowLabel}>{c.essential.label}</span>
              <span className={styles.rowDesc}>{c.essential.desc}</span>
            </div>
            <span className={styles.alwaysOn}>{c.alwaysOn}</span>
          </div>

          {/* Analytics */}
          <div className={styles.row}>
            <div className={styles.rowInfo}>
              <span className={styles.rowLabel}>{c.analytics.label}</span>
              <span className={styles.rowDesc}>{c.analytics.desc}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={analytics}
              className={`${styles.toggle} ${analytics ? styles.toggleOn : ""}`}
              onClick={() => setAnalytics((v) => !v)}
              aria-label={c.analytics.label}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>

          {/* Marketing */}
          <div className={styles.row}>
            <div className={styles.rowInfo}>
              <span className={styles.rowLabel}>{c.marketing.label}</span>
              <span className={styles.rowDesc}>{c.marketing.desc}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={marketing}
              className={`${styles.toggle} ${marketing ? styles.toggleOn : ""}`}
              onClick={() => setMarketing((v) => !v)}
              aria-label={c.marketing.label}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.rejectLink}
            onClick={onRejectAll}
          >
            {c.rejectAll}
          </button>
          <div className={styles.footerActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnOutline}`}
              onClick={onAcceptAll}
            >
              {c.acceptAll}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnFilled}`}
              onClick={() => onSave({ analytics, marketing })}
            >
              {c.savePrefs}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
