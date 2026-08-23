"use client";

import { useWishlist } from "./WishlistContext";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./WishlistButton.module.css";

export default function WishlistButton({ productId, variantId }: { productId: string; variantId?: string }) {
  const t = getTranslations(useLocale());
  const { isWishlisted, toggle } = useWishlist();
  const active = isWishlisted(productId);
  const label = active ? t.shop.removeFromWishlist : t.shop.addToWishlist;

  return (
    <button type="button" className={`${styles.button} ${active ? styles.active : ""}`} onClick={() => toggle(productId, variantId)} aria-pressed={active} aria-label={label} title={label}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
      </svg>
    </button>
  );
}
