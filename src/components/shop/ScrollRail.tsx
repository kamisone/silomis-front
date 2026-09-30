"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./ScrollRail.module.css";

/**
 * A row that scrolls sideways, and says so when there is more of it.
 *
 * Three decisions, and they are the whole component:
 *
 * 1. **No scrollbar.** A bar under a row of pictures reads as a broken layout
 *    rather than a control, and it takes a strip of every screen size to say
 *    something the fade says better.
 * 2. **An arrow only where there is something past it**, never a permanent pair
 *    with one greyed out: a control that cannot do anything costs more than the
 *    space it takes, especially on a phone. Which ends have more is measured —
 *    `scrollLeft`, `clientWidth`, `scrollWidth` — so a row that happens to fit
 *    shows no arrows at all without anyone writing a breakpoint for it.
 * 3. **A fade at that end**, because that is the part actually noticed: the row
 *    visibly continues under it instead of stopping at a hard edge.
 *
 * The caller owns the row itself — `className` styles the scroller, so the card
 * widths, the gap and any snapping belong to whoever is using it.
 */
export default function ScrollRail({
  className,
  wrapClassName,
  prevLabel,
  nextLabel,
  children,
}: {
  /** Styles the scrolling row. Give it `display: flex` and size its children. */
  className: string;
  /** Optional, for positioning the arrows against a particular row height. */
  wrapClassName?: string;
  prevLabel: string;
  nextLabel: string;
  children: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    // A couple of pixels of slack: fractional layout widths leave scrollWidth a
    // hair over clientWidth on a row that cannot actually scroll, which would
    // show an arrow that does nothing.
    const slack = 2;
    setEnds({
      start: el.scrollLeft > slack,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - slack,
    });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    // The row's own width decides whether it overflows, and so does each card's
    // — an item added or removed moves both ends.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure, children]);

  const nudge = (direction: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    // Most of a screenful, not all of it: a card stays partly in view, so it is
    // clear the row moved rather than jumped somewhere else.
    //
    // `behavior: "smooth"` does not consult the reduced-motion setting the way a
    // CSS transition does, so it is asked here.
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: still ? "auto" : "smooth" });
  };

  return (
    <div className={`${styles.wrap} ${wrapClassName ?? ""}`}>
      <div ref={scroller} className={className}>
        {children}
      </div>

      {/* The fade catches the eye; the arrow on top of it is what gets pressed. */}
      {ends.start && (
        <>
          <span className={`${styles.fade} ${styles.fadeStart}`} aria-hidden="true" />
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowStart}`}
            onClick={() => nudge(-1)}
            aria-label={prevLabel}
            title={prevLabel}
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
        </>
      )}
      {ends.end && (
        <>
          <span className={`${styles.fade} ${styles.fadeEnd}`} aria-hidden="true" />
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowEnd}`}
            onClick={() => nudge(1)}
            aria-label={nextLabel}
            title={nextLabel}
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
