import Link from "next/link";
import PromotionBadge, { type PromotionInfo } from "@/components/shop/PromotionBadge";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n";
import styles from "./ProductCard.module.css";

export interface ProductVariantSummary {
  id: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  isDefault: boolean;
}

export interface ProductListItem {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  basePriceCents: number | null;
  featuredImageUrl: string | null;
  cardImageUrls?: string[];
  outOfStock?: boolean;
  defaultVariantOutOfStock?: boolean;
  freeShipping?: boolean;
  categories?: { id: string }[];
  variants: ProductVariantSummary[];
}

export function centsToAmount(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

/** Shared product card used by the shop listing, search, and collection pages. */
export default function ProductCard({
  product,
  promotion,
  locale,
  t,
}: {
  product: ProductListItem;
  promotion: PromotionInfo | null;
  locale: Locale;
  t: ReturnType<typeof getTranslations>;
}) {
  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const priceCents = defaultVariant?.priceCents ?? product.basePriceCents ?? 0;
  const compareAtCents = defaultVariant?.compareAtPriceCents ?? null;
  const isOnSale = !!(compareAtCents && compareAtCents > priceCents);
  const outOfStock = !!product.outOfStock;
  const defaultVariantOos = !!product.defaultVariantOutOfStock;
  const imageUrl = product.cardImageUrls?.[0] ?? product.featuredImageUrl ?? null;

  return (
    <Link href={`/${locale}/shop/${product.slug}`} className={styles.productCard}>
      <div className={styles.productImageWrap}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={product.title} className={styles.productImage} loading="lazy" />
        ) : (
          <div className={styles.productImagePlaceholder} />
        )}
        {outOfStock ? (
          <span className={styles.outOfStockBadge}>{t.shop.outOfStock}</span>
        ) : isOnSale ? (
          <span className={styles.saleBadge}>{t.shop.sale}</span>
        ) : null}
        {product.freeShipping && !outOfStock && <span className={styles.freeShipBadge}>{t.shop.freeShippingBadge}</span>}
      </div>
      <div className={styles.productInfo}>
        {product.brand && <span className={styles.productBrand}>{product.brand}</span>}
        <h3 className={styles.productTitle}>{product.title}</h3>
        <div className={styles.productPrice}>
          {isOnSale && <span className={styles.comparePrice}>{centsToAmount(compareAtCents!)}</span>}
          <span className={styles.price}>{centsToAmount(priceCents)}</span>
          {promotion && <PromotionBadge promotion={promotion} size="sm" freeShippingLabel={t.shop.freeShippingBadge} />}
        </div>
        {defaultVariantOos && !outOfStock && <span className={styles.variantOosNote}>{t.shop.selectedOptionOutOfStock}</span>}
      </div>
    </Link>
  );
}
