"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./Resume.module.css";

export default function ResumeCartPage() {
  const locale = useLocale();
  const t = getTranslations(locale);
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    try {
      localStorage.setItem("shop_cart_token", token);
    } catch {
      // ignore
    }

    // Full navigation (not client-side routing) so CartProvider remounts
    // and re-reads the cart token we just wrote to localStorage.
    window.location.href = `/${locale}/shop/cart`;
  }, [token, locale]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.subtitle}>{t.shop.restoringCart}</p>
      </div>
    </div>
  );
}
