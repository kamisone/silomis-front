"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The scroll mechanics behind the storefront's carousels: native swipe on
 * touch, mouse drag-to-scroll, arrows that step one card, and a dot that
 * tracks the leftmost card in view.
 *
 * Extracted from the related-products carousel when the reviews section needed
 * the same behaviour — the interaction is fiddly enough (drag-vs-click, dot
 * derivation, arrow enablement) that a second copy would be a second set of
 * bugs. Only the mechanics live here; every carousel keeps its own markup and
 * stylesheet, because the cards are what differ, not the scrolling.
 */
export interface CarouselOptions {
  count: number;
  draggingClass: string;
  /** How far an arrow moves: one card, or a full screenful of them. */
  step?: "card" | "page";
  /** Milliseconds for an arrow's travel. 0 hands it to the browser's own
   *  `behavior: "smooth"`, whose duration is not ours to choose — which is
   *  fine until two carousels on one page are meant to feel different. */
  durationMs?: number;
}

export function useCarousel({ count, draggingClass, step = "card", durationMs = 0 }: CarouselOptions) {
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
  }, [syncToScroll, count]);

  const animRef = useRef<number | null>(null);

  /**
   * Tweens scrollLeft over a fixed duration.
   *
   * Native smooth scrolling has one speed per browser, so a "slow, editorial"
   * carousel and a "fast, energetic" one would move identically. Snapping is
   * suspended for the duration: mandatory snap fights a scrollLeft written
   * frame by frame, and re-enabling it at the end lets the track settle on the
   * nearest card anyway.
   */
  const animateTo = useCallback((el: HTMLElement, target: number, duration: number) => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    const from = el.scrollLeft;
    const distance = target - from;
    if (distance === 0) return;

    const snap = el.style.scrollSnapType;
    el.style.scrollSnapType = "none";
    const start = performance.now();
    // easeInOutCubic — starts and stops gently, which is what reads as
    // "deliberate" rather than "flicked".
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      el.scrollLeft = from + distance * ease(p);
      if (p < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = null;
        el.style.scrollSnapType = snap;
      }
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
  }, []);

  const scrollByCard = useCallback(
    (dir: 1 | -1) => {
      const el = trackRef.current;
      const first = slideRefs.current[0];
      if (!el || !first) return;
      const gap = parseFloat(getComputedStyle(el).gap || "16");
      // A page step moves everything currently in view; a card step moves one.
      const distance =
        step === "page" ? el.clientWidth : first.getBoundingClientRect().width + gap;
      const target = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + dir * distance));

      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (durationMs > 0 && !reduced) animateTo(el, target, durationMs);
      else el.scrollTo({ left: target, behavior: reduced ? "auto" : "smooth" });
    },
    [step, durationMs, animateTo],
  );

  const scrollToIndex = useCallback((i: number) => {
    slideRefs.current[i]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, []);

  const setSlideRef = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      slideRefs.current[i] = el;
    },
    [],
  );

  // Mouse drag-to-scroll; touch devices already get native swipe via scroll-snap.
  const trackProps = {
    ref: trackRef,
    onPointerDown(e: React.PointerEvent) {
      if (e.pointerType !== "mouse") return;
      const el = trackRef.current;
      if (!el) return;
      dragRef.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
      el.classList.add(draggingClass);
    },
    onPointerMove(e: React.PointerEvent) {
      const state = dragRef.current;
      const el = trackRef.current;
      if (!state.down || !el) return;
      const dx = e.clientX - state.startX;
      if (Math.abs(dx) > 4) state.moved = true;
      el.scrollLeft = state.startScroll - dx;
    },
    onPointerUp: endDrag,
    onPointerLeave: endDrag,
    /** Swallow the click that ends a drag so it doesn't activate whatever is
     *  under the cursor. */
    onClickCapture(e: React.MouseEvent) {
      if (dragRef.current.moved) {
        e.preventDefault();
        e.stopPropagation();
        dragRef.current.moved = false;
      }
    },
  };

  function endDrag() {
    trackRef.current?.classList.remove(draggingClass);
    dragRef.current.down = false;
  }

  return { trackProps, setSlideRef, scrollByCard, scrollToIndex, activeIndex, canScrollPrev, canScrollNext };
}
