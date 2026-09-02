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
  /** Admin-set flag, not a date window — see Product.isNew in the schema. */
  isNew?: boolean;
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
  // The number is the offer. "Sale" tells a shopper a rule changed; "-27%"
  // tells them by how much, which is the only part they weigh against the
  // price printed directly underneath it. Rounded, never to 0% — a reduction
  // too small to round up to 1% is not worth a badge, but it has one, so it
  // shows the floor rather than a lie.
  const salePercent = isOnSale ? Math.max(1, Math.round(((compareAtCents! - priceCents) / compareAtCents!) * 100)) : 0;
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
        {/* Stacked, not one slot each: a product can be new *and* on sale, and
            before this they were both pinned to the same top-left corner. Out
            of stock replaces them — nothing else about the product matters
            once it cannot be bought. */}
        <span className={styles.badgeStack}>
          {outOfStock ? (
            <span className={styles.outOfStockBadge}>{t.shop.outOfStock}</span>
          ) : (
            <>
              {product.isNew && <span className={styles.newBadge}>{t.shop.newBadge}</span>}
              {isOnSale && (
                <span className={styles.saleBadge}>
                  <span className={styles.salePercent}>-{salePercent}%</span>
                  <span className={styles.saleWord}>{t.shop.sale}</span>
                </span>
              )}
            </>
          )}
        </span>
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
