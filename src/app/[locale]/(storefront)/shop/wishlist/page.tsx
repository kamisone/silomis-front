"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWishlist } from "@/components/shop/WishlistContext";
import WishlistButton from "@/components/shop/WishlistButton";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./page.module.css";

interface ProductLite {
  id: string;
  slug: string;
  title: string;
  basePriceCents: number | null;
  featuredImageUrl: string | null;
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

export default function WishlistPage() {
  const locale = useLocale();
  const t = getTranslations(locale);
  const { items, loading: wishlistLoading } = useWishlist();
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wishlistLoading) return;
    const t = setTimeout(() => {
      if (items.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      fetch(`/next-api/public/shop/products?ids=${items.map((i) => i.productId).join(",")}&limit=100`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => setProducts(data.items ?? []))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, [items, wishlistLoading]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t.shop.wishlistPageTitle}</h1>

      {loading || wishlistLoading ? (
        <p>{t.shop.loading}</p>
      ) : products.length === 0 ? (
        <div className={styles.empty}>
          <p>{t.shop.wishlistEmpty}</p>
          <Link href={`/${locale}/shop`} className={styles.emptyCta}>{t.shop.browseProducts}</Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {products.map((p) => (
            <div key={p.id} className={styles.card}>
              <Link href={`/${locale}/shop/${p.slug}`} className={styles.cardLink}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.featuredImageUrl && <img src={p.featuredImageUrl} alt={p.title} className={styles.cardImage} />}
                <span className={styles.cardTitle}>{p.title}</span>
                {p.basePriceCents !== null && <span className={styles.cardPrice}>{eur(p.basePriceCents)}</span>}
              </Link>
              <div className={styles.cardAction}>
                <WishlistButton productId={p.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
