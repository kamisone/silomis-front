"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import WishlistButton from "./WishlistButton";
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
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);
  const dragRef = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  /** Recomputes arrow enablement and the active dot from scroll position.
   * Deriving the dot from scrollLeft rather than an IntersectionObserver is
   * deliberate: several cards are ≥60% visible at once, so an observer has no
   * unambiguous winner and whichever entry it reports last would take the dot.
   * The leftmost card in view is the one the dots should track. */
  const syncToScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollPrev(el.scrollLeft > 4);
    setCanScrollNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);

    const trackLeft = el.getBoundingClientRect().left;
    let nearest = 0;
    let best = Infinity;
    slideRefs.current.forEach((slide, i) => {
      if (!slide) return;
      const delta = Math.abs(slide.getBoundingClientRect().left - trackLeft);
      if (delta < best) {
        best = delta;
        nearest = i;
      }
    });
    setActiveIndex(nearest);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    // Deferred so the first measurement doesn't setState during the effect
    // that mounts the track (react-hooks/set-state-in-effect).
    const initial = setTimeout(syncToScroll, 0);
    el.addEventListener("scroll", syncToScroll, { passive: true });
    const ro = new ResizeObserver(syncToScroll);
    ro.observe(el);
    return () => {
      clearTimeout(initial);
      el.removeEventListener("scroll", syncToScroll);
      ro.disconnect();
    };
  }, [syncToScroll, items.length]);

  function scrollByCard(dir: 1 | -1) {
    const el = trackRef.current;
    const first = slideRefs.current[0];
    if (!el || !first) return;
    const gap = parseFloat(getComputedStyle(el).gap || "16");
    el.scrollBy({ left: dir * (first.getBoundingClientRect().width + gap), behavior: "smooth" });
  }

  // Mouse drag-to-scroll; touch devices already get native swipe via scroll-snap.
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    const el = trackRef.current;
    if (!el) return;
    dragRef.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    el.classList.add(styles.dragging);
  }
  function onPointerMove(e: React.PointerEvent) {
    const state = dragRef.current;
    const el = trackRef.current;
    if (!state.down || !el) return;
    const dx = e.clientX - state.startX;
    if (Math.abs(dx) > 4) state.moved = true;
    el.scrollLeft = state.startScroll - dx;
  }
  function endDrag() {
    trackRef.current?.classList.remove(styles.dragging);
    dragRef.current.down = false;
  }
  /** Swallow the click that ends a drag so it doesn't open the card underneath. */
  function onTrackClickCapture(e: React.MouseEvent) {
    if (dragRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current.moved = false;
    }
  }

  if (!items.length) return null;

  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>

      <div className={styles.viewport}>
        <div
          ref={trackRef}
          className={styles.track}
          role="group"
          aria-roledescription="carousel"
          aria-label={title}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClickCapture={onTrackClickCapture}
        >
          {items.map((item, i) => (
            <Card
              key={item.id}
              item={item}
              locale={locale}
              viewLabel={t.shop.viewProduct}
              freeShippingLabel={t.shop.freeShippingBadge}
              setSlideRef={(el) => {
                slideRefs.current[i] = el;
              }}
            />
          ))}
        </div>

        {items.length > 1 && (
          <>
            <button type="button" className={`${styles.arrow} ${styles.arrowPrev}`} onClick={() => scrollByCard(-1)} disabled={!canScrollPrev} aria-label={t.shop.carouselPrev}>
              <ChevronLeft size={20} strokeWidth={2.25} />
            </button>
            <button type="button" className={`${styles.arrow} ${styles.arrowNext}`} onClick={() => scrollByCard(1)} disabled={!canScrollNext} aria-label={t.shop.carouselNext}>
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
              className={`${styles.dot} ${i === activeIndex ? styles.dotActive : ""}`}
              onClick={() => slideRefs.current[i]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" })}
              aria-label={`${t.shop.goToProduct} ${i + 1}`}
              aria-current={i === activeIndex}
            />
          ))}
        </div>
      )}
    </section>
  );
}
