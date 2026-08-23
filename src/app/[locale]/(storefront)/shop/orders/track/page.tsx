"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./track.module.css";

export default function OrderTrackLookupPage() {
  const locale = useLocale();
  const t = getTranslations(locale);
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = orderNumber.trim().toUpperCase();
    const em = email.trim().toLowerCase();
    if (!num || !em) return;

    setLoading(true);
    setError("");

    const res = await fetch(`/next-api/public/shop/orders/${encodeURIComponent(num)}/track?email=${encodeURIComponent(em)}`);
    if (res.ok) {
      router.push(`/${locale}/shop/orders/track/${encodeURIComponent(num)}?email=${encodeURIComponent(em)}`);
    } else {
      setError(t.shop.trackOrderNotFound);
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16.5 9.4 7.55 4.24" />
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.29 7 8.71 5 8.71-5" />
            <line x1="12" y1="22" x2="12" y2="12" />
          </svg>
        </div>
        <h1 className={styles.title}>{t.shop.trackOrderTitle}</h1>
        <p className={styles.subtitle}>{t.shop.trackOrderSubtitle}</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>{t.shop.trackOrderNumber}</label>
            <input className={styles.input} placeholder="ORD-000001" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t.shop.emailLabel}</label>
            <input className={styles.input} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? t.shop.searching : t.shop.trackOrderSubmit}
          </button>
        </form>
      </div>
    </div>
  );
}
