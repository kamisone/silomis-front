import Link from "next/link";
import AddToCartButton from "@/components/shop/AddToCartButton";
import ProductCardMedia from "@/components/shop/ProductCardMedia";
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
  // Featured image first, then the gallery — the API already returns them in
  // that order (capped at 5) as cardImageUrls. Falling back to featuredImageUrl
  // keeps cards working for any caller that doesn't request the gallery.
  const images = product.cardImageUrls?.length
    ? product.cardImageUrls
    : product.featuredImageUrl
      ? [product.featuredImageUrl]
      : [];

  const href = `/${locale}/shop/${product.slug}`;

  // The card is a div rather than one big <Link>: it now carries its own
  // add-to-cart control, and a button nested inside an anchor is invalid markup
  // that navigates on click. The image and the title are each their own link,
  // so the whole visual card still reads (and tabs) as one target.
  return (
    <div className={styles.productCard}>
      {/* Badges stay here, server-rendered, and are slotted over the image by
          ProductCardMedia — only the image switcher itself needs client JS. */}
      <ProductCardMedia
        images={images}
        title={product.title}
        href={href}
        prevLabel={t.shop.prevImage}
        nextLabel={t.shop.nextImage}
      >
        {outOfStock ? (
          <span className={styles.outOfStockBadge}>{t.shop.outOfStock}</span>
        ) : isOnSale ? (
          <span className={styles.saleBadge}>{t.shop.sale}</span>
        ) : null}
        {product.freeShipping && !outOfStock && <span className={styles.freeShipBadge}>{t.shop.freeShippingBadge}</span>}
      </ProductCardMedia>
      <div className={styles.productInfo}>
        {product.brand && <span className={styles.productBrand}>{product.brand}</span>}
        <h3 className={styles.productTitle}>
          <Link href={href} className={styles.productTitleLink}>
            {product.title}
          </Link>
        </h3>
        <div className={styles.productPrice}>
          {isOnSale && <span className={styles.comparePrice}>{centsToAmount(compareAtCents!)}</span>}
          <span className={styles.price}>{centsToAmount(priceCents)}</span>
          {promotion && <PromotionBadge promotion={promotion} size="sm" freeShippingLabel={t.shop.freeShippingBadge} />}
        </div>
        {defaultVariantOos && !outOfStock && <span className={styles.variantOosNote}>{t.shop.selectedOptionOutOfStock}</span>}

        {/* Nothing left to buy → a dead pill; a product whose default variant is
            gone but which has other options → send them to the PDP to pick one;
            otherwise add the default variant straight from the card. */}
        <div className={styles.cardAction}>
          {outOfStock ? (
            <span className={styles.outOfStockBtn}>{t.shop.outOfStock}</span>
          ) : defaultVariantOos ? (
            <Link href={href} className={styles.seeDetailsBtn}>
              {t.shop.seeDetails}
            </Link>
          ) : defaultVariant?.id ? (
            <AddToCartButton variantId={defaultVariant.id} size="sm" />
          ) : (
            <Link href={href} className={styles.seeDetailsBtn}>
              {t.shop.seeDetails}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
