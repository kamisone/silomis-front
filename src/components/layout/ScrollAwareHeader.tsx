"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ScrollAwareHeader.module.css";

export default function ScrollAwareHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 10);
      if (y < 80) {
        setHidden(false);
      } else if (y > lastY.current) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keep --header-offset and --header-height in sync with the real, measured
  // header height — the commerce header has two rows and wraps onto extra
  // lines at some breakpoints, so a hardcoded px value drifts out of sync and
  // lets the fixed header cover page content.
  useEffect(() => {
    const setOffset = () => {
      const height = headerRef.current?.offsetHeight ?? 64;
      document.documentElement.style.setProperty("--header-offset", hidden ? "0px" : `${height}px`);
      document.documentElement.style.setProperty("--header-height", `${height}px`);
    };
    setOffset();
    window.addEventListener("resize", setOffset, { passive: true });
    return () => window.removeEventListener("resize", setOffset);
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
