"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ScrollAwareHeader.module.css";

/**
 * The band at the top of the page where the header is shown whichever way the
 * last scroll was going.
 *
 * A share of the page rather than a flat 80px: the reason the header could be
 * caught hidden at the very top was a bounce/fling arriving there faster than
 * the scroll events describing it, and a wider band is simply harder to land
 * past. The floor keeps it sane on a short page, the ceiling stops it becoming
 * "the header never hides" on a very long one.
 */
const REVEAL_ZONE_RATIO = 0.05;
const REVEAL_ZONE_MIN_PX = 80;
const REVEAL_ZONE_MAX_PX = 400;

export default function ScrollAwareHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Measured here and on resize rather than per scroll event: scrollHeight
    // forces a layout read, and doing that on every scroll tick is exactly the
    // kind of thing that makes a phone stutter.
    let revealZone = REVEAL_ZONE_MIN_PX;
    const measure = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      revealZone = Math.min(REVEAL_ZONE_MAX_PX, Math.max(REVEAL_ZONE_MIN_PX, scrollable * REVEAL_ZONE_RATIO));
    };
    measure();

    // iOS reports a *negative* scrollY while the page is rubber-banded past the
    // top. Unclamped it lands in lastY, and the spring back to rest then reads
    // as scrolling down (0 > -40) — hiding the header at the one position it
    // must never be hidden.
    const currentY = () => Math.max(0, window.scrollY);

    lastY.current = currentY();
    const onScroll = () => {
      const y = currentY();
      setScrolled(y > 10);
      if (y <= revealZone) {
        setHidden(false);
      } else if (y > lastY.current) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastY.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
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
