"use client";

import { useEffect, useRef, useState } from "react";
import ImageLightbox from "@/components/shop/ImageLightbox";
import StoryLazyImage from "./StoryLazyImage";
import styles from "./StoryGallery.module.css";

/** Narrative-image display ratio, chosen per image by the admin — not applicable to side items. */
export type StoryImageAspectRatio = "1:1" | "16:9" | "9:16";

export interface StoryGalleryItem {
  id: string;
  url: string;
  altText?: string | null;
  title?: string;
  description?: string;
  /** Narrative items only — defaults to '1:1' when absent (side items, or items saved before this field existed). */
  aspectRatio?: StoryImageAspectRatio;
}

/** Percent-based layout slots inside the aspect-ratio canvas. depth drives parallax speed. */
const SLOTS = [
  { top: "2%", left: "8%", width: "54%", rotate: -5, depth: 0.35, z: 3, ratio: "4 / 5" },
  { top: "16%", left: "52%", width: "44%", rotate: 4, depth: 0.9, z: 2, ratio: "3 / 4" },
  { top: "46%", left: "18%", width: "46%", rotate: -3, depth: 1.25, z: 4, ratio: "1 / 1" },
  { top: "58%", left: "56%", width: "38%", rotate: 6, depth: 0.6, z: 1, ratio: "4 / 5" },
  { top: "36%", left: "0%", width: "30%", rotate: 7, depth: 1.6, z: 5, ratio: "3 / 4" },
  { top: "74%", left: "34%", width: "34%", rotate: -6, depth: 1.0, z: 6, ratio: "4 / 3" },
] as const;

/** Tighter, calmer arrangements when there are only 1–2 images. */
const SLOTS_SMALL = [
  { top: "6%", left: "12%", width: "72%", rotate: -3, depth: 0.6, z: 2, ratio: "4 / 5" },
  { top: "48%", left: "38%", width: "56%", rotate: 4, depth: 1.2, z: 3, ratio: "1 / 1" },
] as const;

/**
 * Location 1 — Creative Side Gallery.
 * Organic composition of overlapping, gently rotated cards with scroll
 * parallax and staggered reveal. Rendered next to the FAQ section on the PDP.
 */
export default function StorySideGallery({ items, ariaLabel }: { items: StoryGalleryItem[]; ariaLabel: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [revealed, setRevealed] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const shown = items.slice(0, SLOTS.length);
  const slots = shown.length <= 2 ? SLOTS_SMALL : SLOTS;

  // Staggered reveal once the composition scrolls into view.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scroll parallax — each card drifts at its own depth. rAF-throttled,
  // active only while the composition is on screen, disabled for
  // prefers-reduced-motion.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let active = false;

    const apply = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      // -1 (below viewport) → +1 (above viewport), 0 when centered
      const progress = (window.innerHeight / 2 - (rect.top + rect.height / 2)) / window.innerHeight;
      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        const depth = (slots[i % slots.length] ?? slots[0]).depth;
        card.style.transform = `translate3d(0, ${(progress * depth * 36).toFixed(1)}px, 0)`;
      });
    };

    const onScroll = () => {
      if (!active || raf) return;
      raf = requestAnimationFrame(apply);
    };

    const visibility = new IntersectionObserver(
      ([entry]) => {
        active = entry.isIntersecting;
        if (active) onScroll();
      },
      { rootMargin: "120px" },
    );
    visibility.observe(el);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      visibility.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [slots]);

  if (shown.length === 0) return null;

  return (
    <>
      <div ref={containerRef} className={`${styles.sideCanvas} ${revealed ? styles.sideCanvasRevealed : ""}`} role="group" aria-label={ariaLabel}>
        {shown.map((item, i) => {
          const slot = slots[i % slots.length];
          return (
            <div
              key={item.id}
              ref={(node) => {
                cardRefs.current[i] = node;
              }}
              className={styles.sideSlot}
              style={{ top: slot.top, left: slot.left, width: slot.width, zIndex: slot.z }}
            >
              <figure
                className={styles.sideCard}
                style={
                  {
                    "--story-rotate": `${slot.rotate}deg`,
                    aspectRatio: slot.ratio,
                    animationDelay: `${i * 90}ms`,
                  } as React.CSSProperties
                }
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                aria-label={item.title?.trim() || item.altText || `${i + 1} / ${shown.length}`}
                onClick={() => setLightboxIndex(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLightboxIndex(i);
                  }
                }}
              >
                <StoryLazyImage src={item.url} alt={item.altText ?? ""} />
              </figure>
            </div>
          );
        })}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox images={shown} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} ariaLabel={ariaLabel} />
      )}
    </>
  );
}
