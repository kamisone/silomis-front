"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import WishlistButton from "./WishlistButton";
import { useCarousel } from "./useCarousel";
import { centsToAmount } from "./ProductCard";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./RelatedProductsCarousel.module.css";

export interface RelatedProduct {
  id: string;
  slug: string;
  title: string;
  minPriceCents: number | null;
  featuredImageUrl: string | null;
  freeShipping: boolean;
}

/** Widths the cards actually occupy at each breakpoint — keep in step with
 * `.slide` in the stylesheet so next/image requests the right source size. */
const IMAGE_SIZES = "(max-width: 560px) 78vw, (max-width: 900px) 44vw, (max-width: 1200px) 30vw, 23vw";

function Card({ item, locale, viewLabel, freeShippingLabel, setSlideRef }: {
  item: RelatedProduct;
  locale: Locale;
  viewLabel: string;
  freeShippingLabel: string;
  setSlideRef: (el: HTMLElement | null) => void;
}) {
  return (
    <article ref={setSlideRef} className={styles.slide}>
      <Link href={`/${locale}/shop/${item.slug}`} className={styles.card}>
        <div className={styles.imageWrap}>
          {item.featuredImageUrl ? (
            <Image src={item.featuredImageUrl} alt={item.title} fill loading="lazy" sizes={IMAGE_SIZES} className={styles.image} />
          ) : (
            <div className={styles.imagePlaceholder} />
          )}
          {item.freeShipping && <span className={styles.freeShipBadge}>{freeShippingLabel}</span>}
        </div>

        <div className={styles.info}>
          <h3 className={styles.cardTitle}>{item.title}</h3>
          {item.minPriceCents != null && <span className={styles.price}>{centsToAmount(item.minPriceCents)}</span>}
          <span className={styles.cta}>{viewLabel}</span>
        </div>
      </Link>

      {/* Sibling of the link, not a child — a button nested inside an anchor is
          invalid markup and would need click-swallowing to avoid navigating. */}
      <div className={styles.wishlist}>
        <WishlistButton productId={item.id} />
      </div>
    </article>
  );
}

/**
 * Horizontally snap-scrolling carousel of related products: native swipe on
 * touch, mouse drag-to-scroll, arrow buttons, and pagination dots.
 */
export default function RelatedProductsCarousel({ items, locale, title }: { items: RelatedProduct[]; locale: Locale; title: string }) {
  const t = getTranslations(locale);
  const carousel = useCarousel({ count: items.length, draggingClass: styles.dragging });

  if (!items.length) return null;

  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>

      <div className={styles.viewport}>
        <div
          {...carousel.trackProps}
          className={styles.track}
          role="group"
          aria-roledescription="carousel"
          aria-label={title}
          tabIndex={0}
        >
          {items.map((item, i) => (
            <Card
              key={item.id}
              item={item}
              locale={locale}
              viewLabel={t.shop.viewProduct}
              freeShippingLabel={t.shop.freeShippingBadge}
              setSlideRef={carousel.setSlideRef(i)}
            />
          ))}
        </div>

        {items.length > 1 && (
          <>
            <button type="button" className={`${styles.arrow} ${styles.arrowPrev}`} onClick={() => carousel.scrollByCard(-1)} disabled={!carousel.canScrollPrev} aria-label={t.shop.carouselPrev}>
              <ChevronLeft size={20} strokeWidth={2.25} />
            </button>
            <button type="button" className={`${styles.arrow} ${styles.arrowNext}`} onClick={() => carousel.scrollByCard(1)} disabled={!carousel.canScrollNext} aria-label={t.shop.carouselNext}>
              <ChevronRight size={20} strokeWidth={2.25} />
            </button>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div className={styles.dots}>
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.dot} ${i === carousel.activeIndex ? styles.dotActive : ""}`}
              onClick={() => carousel.scrollToIndex(i)}
              aria-label={`${t.shop.goToProduct} ${i + 1}`}
              aria-current={i === carousel.activeIndex}
            />
          ))}
        </div>
      )}
    </section>
  );
}
