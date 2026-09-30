"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ScrollAwareHeader.module.css";

/**
 * How far the page has to travel down before the header gets out of the way.
 *
 * Cheap, and deliberately so. Somebody scrolling down has decided to read what
 * is below, and the header is 110px of chrome sitting on top of it, so it should
 * go almost as soon as they mean it — about half the header's own height.
 */
const HIDE_AFTER_PX = 48;

/**
 * How close to the top of the page the header comes back — and the ONLY way it
 * comes back.
 *
 * Scrolling up part-way through a page does not bring it down over the paragraph
 * being read. Once it has gone it is gone until the reader is back near the top,
 * with no more than this much scrolling left to go.
 *
 * An absolute position rather than a distance travelled up, which is what this
 * replaced. A travelled-distance rule makes the header's state depend on how the
 * reader got to where they are, so the same place on the page shows it or hides it
 * according to history — and any value low enough to feel responsive also lets a
 * long upward flick halfway down drop it over the text. Measured from the top it
 * is a property of WHERE YOU ARE: near the top the header is there, everywhere
 * else it is not, which is a rule a reader learns without thinking about it.
 *
 * It also guards against the header being caught hidden AT the top. iOS reports a
 * negative scrollY while rubber-banding past it and the spring back reads as a
 * downward scroll, so this band has to be wide enough to be hard to land past
 * during a fling: much below about 150 and a fast throw to the top can leave the
 * page at rest with no header.
 */
const SHOW_WITHIN_PX = 100;

export default function ScrollAwareHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // iOS reports a *negative* scrollY while the page is rubber-banded past the
    // top. Unclamped it lands in lastY, and the spring back to rest then reads
    // as scrolling down (0 > -40) — hiding the header at the one position it
    // must never be hidden.
    const currentY = () => Math.max(0, window.scrollY);

    lastY.current = currentY();
    // Where the scroll last turned around. Hiding is measured from there rather
    // than from wherever the last event landed, so a wobble of the thumb — or a
    // page that settles a few pixels after a fling — does not hide it.
    let anchorY = lastY.current;
    let goingDown = false;
    const onScroll = () => {
      const y = currentY();
      setScrolled(y > 10);
      const down = y > lastY.current;
      if (y !== lastY.current && down !== goingDown) {
        anchorY = lastY.current;
        goingDown = down;
      }
      if (y <= SHOW_WITHIN_PX) {
        // Back near the top: shown whichever way the scroll was going, and the
        // anchor follows, so leaving again costs a full HIDE_AFTER_PX rather than
        // whatever was left over from the way in.
        setHidden(false);
        anchorY = y;
      } else if (goingDown && y - anchorY >= HIDE_AFTER_PX) {
        setHidden(true);
      }
      // There is deliberately no branch for scrolling up. Below SHOW_WITHIN_PX
      // the header stays hidden however far back up the page the reader travels.
      lastY.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
