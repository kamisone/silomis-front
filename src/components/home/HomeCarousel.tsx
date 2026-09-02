"use client";

import { Children, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCarousel } from "@/components/shop/useCarousel";
import styles from "./HomeCarousel.module.css";

/**
 * Each home section scrolls differently on purpose, so the variant is the one
 * thing a caller passes and everything that follows from it lives here:
 *
 *  collections — one dominant card with the next peeking in, slow and
 *                deliberate, because the point is to look at one thing.
 *  sale        — many small cards, tight, quick; a dense run of offers.
 *  products    — four and a half portrait cards, one card per press, a small
 *                movement that does not disturb the grid-like reading.
 *  categories  — a whole screenful moves at once: these are destinations, not
 *                a sequence, so paging through them beats nudging.
 *  blog        — wide landscape cards, generously spaced, unhurried.
 */
export type CarouselVariant = "collections" | "sale" | "products" | "categories" | "blog";

const BEHAVIOUR: Record<CarouselVariant, { step: "card" | "page"; durationMs: number }> = {
  collections: { step: "card", durationMs: 760 },
  sale: { step: "card", durationMs: 320 },
  products: { step: "card", durationMs: 420 },
  categories: { step: "page", durationMs: 520 },
  blog: { step: "card", durationMs: 680 },
};

/**
 * The scrolling mechanics for every home-page carousel.
 *
 * Cards come in as `children` rather than as data, which is what keeps the
 * sections themselves server components — a product card that crossed into
 * this bundle would bring its price formatting and badges with it. The slides
 * are wrapped here because useCarousel measures them.
 */
export default function HomeCarousel({
  variant,
  label,
  prevLabel,
  nextLabel,
  children,
}: {
  variant: CarouselVariant;
  label: string;
  prevLabel: string;
  nextLabel: string;
  children: ReactNode;
}) {
  const slides = Children.toArray(children);
  const { step, durationMs } = BEHAVIOUR[variant];
  const carousel = useCarousel({ count: slides.length, draggingClass: styles.dragging, step, durationMs });

  if (slides.length === 0) return null;

  return (
    <div className={styles.viewport} data-variant={variant}>
      <div
        {...carousel.trackProps}
        className={styles.track}
        role="group"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
      >
        {slides.map((slide, i) => (
          <div key={i} ref={carousel.setSlideRef(i)} className={styles.slide}>
            {slide}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowPrev}`}
            onClick={() => carousel.scrollByCard(-1)}
            disabled={!carousel.canScrollPrev}
            aria-label={prevLabel}
          >
            <ChevronLeft size={20} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowNext}`}
            onClick={() => carousel.scrollByCard(1)}
            disabled={!carousel.canScrollNext}
            aria-label={nextLabel}
          >
            <ChevronRight size={20} strokeWidth={2.25} />
          </button>
        </>
      )}
    </div>
  );
}
