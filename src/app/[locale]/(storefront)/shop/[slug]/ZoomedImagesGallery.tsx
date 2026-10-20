"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ZoomedImagesGallery.module.css";

export interface ZoomedImageItem {
  id: string;
  url: string;
  altText?: string | null;
}

/** Seconds each image takes to cross the strip — total loop duration scales
 *  with the item count so the visual speed stays constant regardless of how
 *  many images there are, instead of a long list flying past faster. */
const SECONDS_PER_IMAGE = 4.5;

/** Phones: how long each image stays put, then how long the slide to the next takes. */
const SLIDE_HOLD_MS = 1000;
const SLIDE_MOVE_MS = 500;
const PHONE_QUERY = "(max-width: 640px)";

/**
 * Phones: one big image at a time, held a second, then slid out by the next.
 * Loops forward forever: the first image is repeated at the end, and once
 * the slide onto that copy finishes the track jumps back to the real first
 * one with no transition — the same picture, so the jump is invisible.
 * Only runs on a phone-width screen and while the section is on screen.
 */
function PhoneSlideshow({ items }: { items: ZoomedImageItem[] }) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const count = items.length;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || count < 2 || !window.matchMedia(PHONE_QUERY).matches) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setInterval(() => {
      setAnimate(!reduced);
      setIndex((i) => (reduced ? (i + 1) % count : i + 1));
    }, SLIDE_HOLD_MS + SLIDE_MOVE_MS);
    return () => clearInterval(id);
  }, [visible, count]);

  const slides = count > 1 ? [...items, items[0]] : items;

  return (
    <div ref={rootRef} className={styles.slideshow} aria-hidden="true">
      <div
        className={styles.slideTrack}
        style={{ transform: `translateX(-${index * 100}%)`, transition: animate ? `transform ${SLIDE_MOVE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` : "none" }}
        onTransitionEnd={() => {
          if (index >= count) {
            setAnimate(false);
            setIndex(0);
          }
        }}
      >
        {slides.map((item, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`${item.id}-${i}`} src={item.url} alt="" decoding="async" draggable={false} className={styles.slideImg} />
        ))}
      </div>
    </div>
  );
}

/**
 * Automatically scrolling filmstrip — purely decorative and non-interactive
 * (no lightbox, no click target). Hovering only pauses the motion. Loops
 * seamlessly by rendering every image twice back to back and animating the
 * track by exactly -50% — an identical second copy means the loop restarts
 * on a pixel-identical frame.
 */
export default function ZoomedImagesGallery({ items, title, ariaLabel, fullBleed = false }: {
  items: ZoomedImageItem[];
  /** Optional static heading — hidden when empty. */
  title?: string;
  ariaLabel: string;
  /** Break out to the full browser viewport width. Only safe when this
   *  section isn't sharing a constrained grid row with something else (see
   *  the caller in ShopProductDetail.tsx) — defaults to false (fills its own container). */
  fullBleed?: boolean;
}) {
  if (items.length === 0) return null;

  const duration = items.length * SECONDS_PER_IMAGE;
  const track = [...items, ...items];

  return (
    <section className={styles.section} aria-label={ariaLabel}>
      {title?.trim() && <h2 className={styles.heading}>{title}</h2>}

      <PhoneSlideshow items={items} />

      <div className={`${styles.viewport} ${fullBleed ? styles.viewportFullBleed : ""}`} aria-hidden="true">
        <div className={styles.track} style={{ animationDuration: `${duration}s` }}>
          {track.map((item, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${item.id}-${i}`}
              src={item.url}
              alt=""
              loading={i < items.length ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              className={styles.img}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
