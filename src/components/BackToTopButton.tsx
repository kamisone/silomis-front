"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import styles from "./BackToTopButton.module.css";

interface Props {
  /** Scroll depth (px) after which the button appears. */
  threshold?: number;
  ariaLabel?: string;
}

/**
 * Floating back-to-top button: fades in after scrolling past `threshold`,
 * smooth-scrolls to the top (instant for reduced-motion users).
 */
export default function BackToTopButton({ threshold = 600, ariaLabel = "Back to top" }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setVisible(window.scrollY > threshold);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [threshold]);

  function scrollToTop() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      className={`${styles.btn} ${visible ? styles.btnVisible : ""}`}
      onClick={scrollToTop}
      aria-label={ariaLabel}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUp size={18} strokeWidth={2.25} />
    </button>
  );
}
