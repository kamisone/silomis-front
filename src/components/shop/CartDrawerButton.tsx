"use client";

import { useCart } from "./CartContext";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./CartDrawerButton.module.css";

/**
 * Opens the cart drawer from the product page's buy row, beside wishlist and
 * share. The header's cart icon does the same, but on a product page the
 * customer's eyes are on the buy button, and after adding a cap the next
 * thing they want is the basket. Carries the item count, like the header.
 */
export default function CartDrawerButton() {
  const t = getTranslations(useLocale());
  const { cart, openDrawer } = useCart();
  const count = cart?.itemCount ?? 0;
  const label = count > 0 ? `${t.shop.cartTitle}, ${count}` : t.shop.cartTitle;

  return (
    <button type="button" className={styles.button} onClick={openDrawer} aria-label={label} title={t.shop.cartTitle}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {count > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
