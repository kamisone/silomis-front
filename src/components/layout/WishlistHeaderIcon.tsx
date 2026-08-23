"use client";

import Link from "next/link";
import { useWishlist } from "@/components/shop/WishlistContext";
import styles from "./HeaderIconButton.module.css";

export default function WishlistHeaderIcon({ locale, label }: { locale: string; label?: string }) {
  const { items } = useWishlist();
  const count = items.length;
  const title = label ?? "Wishlist";

  return (
    <Link href={`/${locale}/shop/wishlist`} className={styles.iconBtn} aria-label={count > 0 ? `${title}, ${count}` : title} title={title}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
      </svg>
      {count > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
