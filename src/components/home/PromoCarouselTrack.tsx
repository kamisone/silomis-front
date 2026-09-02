"use client";

import { Children, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCarousel } from "@/components/shop/useCarousel";
import styles from "./PromoProductsCarousel.module.css";

/**
 * The scrolling mechanics only — swipe, drag, and arrows.
 *
 * Takes the cards as `children` rather than taking the products and rendering
 * them itself, which is what keeps ProductCard on the server: a card that
 * crossed into this bundle would drag the whole listing card, its price
 * formatting and its badges into the client for a section that needs none of
 * it. The slides are wrapped here because useCarousel measures them.
 *
 * No dots on purpose — the row's whole message is "there is more to the
 * right", and the arrows plus the view-all already say it twice.
 */
export default function PromoCarouselTrack({
  children,
  label,
  prevLabel,
  nextLabel,
}: {
  children: ReactNode;
  label: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const slides = Children.toArray(children);
  const carousel = useCarousel({ count: slides.length, draggingClass: styles.dragging });

  return (
    <div className={styles.viewport}>
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
