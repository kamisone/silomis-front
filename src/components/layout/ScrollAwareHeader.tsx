"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ScrollAwareHeader.module.css";

/** At or below this the header is always shown, whichever way the last scroll
 *  was going — the top of the page is not somewhere to hide navigation. */
const ALWAYS_SHOWN_BELOW = 80;

/** How long after the last scroll event to re-check where we actually landed.
 *  Long enough that it fires once at the end of a fling rather than through
 *  it, short enough not to be perceived as a delay. */
const SETTLE_MS = 150;

export default function ScrollAwareHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Clamped everywhere it is read: iOS rubber-banding reports a *negative*
    // scrollY while the page is bounced past the top, and storing one of those
    // as the previous position makes the spring back to 0 read as scrolling
    // *down* (0 > -40), which hides the header at the very top of the page.
    const currentY = () => Math.max(0, window.scrollY);

    /** The directional rule: hide going down, show going up, always show near
     *  the top. Driven by scroll events. */
    const evaluate = () => {
      const y = currentY();
      setScrolled(y > 10);
      if (y <= ALWAYS_SHOWN_BELOW) setHidden(false);
      else if (y > lastY.current) setHidden(true);
      else setHidden(false);
      lastY.current = y;
    };

    /**
     * The invariant, re-asserted once scrolling has actually stopped: near the
     * top, the header is visible. Full stop.
     *
     * This exists because the scroll event is not a reliable account of where
     * the page came to rest. During a fast fling on mobile the browser
     * coalesces scroll events and the last one delivered can be from part-way
     * through the gesture, so the handler above may simply never run at the
     * final position — leaving the header translated off-screen at scrollY 0.
     *
     * Deliberately only the "show near the top" half of the rule, not a
     * re-run of `evaluate`: re-running it here would compare y against itself
     * (unchanged, so "not scrolling down") and pop the header back into view
     * every time the page stopped moving, anywhere on it.
     */
    const ensureShownNearTop = () => {
      const y = currentY();
      setScrolled(y > 10);
      lastY.current = y;
      if (y <= ALWAYS_SHOWN_BELOW) setHidden(false);
    };

    let settleTimer = 0;
    const onScroll = () => {
      evaluate();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(ensureShownNearTop, SETTLE_MS);
    };

    lastY.current = currentY();
    // Start from the real position rather than assuming the top: a reload
    // part-way down a page, or a back-navigation that restores scroll, both
    // land here with scrollY already set.
    evaluate();

    window.addEventListener("scroll", onScroll, { passive: true });
    // The purpose-built "scrolling has finished" signal where it exists; the
    // timer above covers the browsers where it does not.
    window.addEventListener("scrollend", ensureShownNearTop);
    // A fling is still decelerating when the finger leaves, so this is not
    // redundant with scrollend — it catches the case where momentum ends
    // without a further scroll event.
    window.addEventListener("touchend", ensureShownNearTop, { passive: true });
    window.addEventListener("touchcancel", ensureShownNearTop, { passive: true });
    // The mobile URL bar collapsing changes the viewport and can move the page
    // under us; a restored bfcache page can come back mid-scroll.
    window.addEventListener("resize", ensureShownNearTop);
    window.addEventListener("orientationchange", ensureShownNearTop);
    window.addEventListener("pageshow", ensureShownNearTop);

    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", ensureShownNearTop);
      window.removeEventListener("touchend", ensureShownNearTop);
      window.removeEventListener("touchcancel", ensureShownNearTop);
      window.removeEventListener("resize", ensureShownNearTop);
      window.removeEventListener("orientationchange", ensureShownNearTop);
      window.removeEventListener("pageshow", ensureShownNearTop);
    };
  }, []);

  // Keep --header-offset and --header-height in sync with the real, measured
  // header height — the commerce header has two rows and wraps onto extra
  // lines at some breakpoints, and its second row (category nav) populates
  // asynchronously after its own data fetch, so a one-time measurement on
  // mount goes stale the moment that content lands. A ResizeObserver tracks
  // the header's actual rendered size continuously instead.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const setOffset = () => {
      const height = el.offsetHeight || 64;
      document.documentElement.style.setProperty("--header-offset", hidden ? "0px" : `${height}px`);
      document.documentElement.style.setProperty("--header-height", `${height}px`);
    };
    setOffset();

    const observer = new ResizeObserver(setOffset);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hidden]);

  return (
    <header
      ref={headerRef}
      className={[styles.header, hidden ? styles.headerHidden : "", scrolled ? styles.scrolled : ""].filter(Boolean).join(" ")}
    >
      {children}
    </header>
  );
}
