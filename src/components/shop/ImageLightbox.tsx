"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./ImageLightbox.module.css";

/** Shape-compatible with StoryGalleryItem — story items can be passed as-is. */
export interface LightboxImage {
  id: string;
  url: string;
  altText?: string | null;
  title?: string;
  description?: string;
}

interface Props {
  images: LightboxImage[];
  /** Image shown first. Clamped to the array bounds. */
  initialIndex?: number;
  onClose: () => void;
  ariaLabel?: string;
}

/**
 * Reusable fullscreen image viewer with carousel navigation.
 * Mount it conditionally (`open !== null && <ImageLightbox … />`) — it portals
 * to <body>, locks page scroll, and supports Esc / ← → keys, touch swipe,
 * a thumbnail strip and an optional per-image title/description caption.
 */
export default function ImageLightbox({ images, initialIndex = 0, onClose, ariaLabel = "Image viewer" }: Props) {
  const [current, setCurrent] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)),
  );
  const touchStartX = useRef<number | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const prev = useCallback(() => setCurrent((c) => (c - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent((c) => (c + 1) % images.length), [images.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  // Lock page scroll while open
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Keep the active thumbnail scrolled into view
  useEffect(() => {
    const active = thumbsRef.current?.children[current] as HTMLElement | undefined;
    active?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [current]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  if (!images.length) return null;
  const active = images[current];
  const hasMany = images.length > 1;
  const title = active.title?.trim();
  const description = active.description?.trim();

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <figure className={styles.stage} onClick={(e) => e.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <span className={styles.glow} aria-hidden="true" />
        {/* Keyed on the image so slide changes replay the entrance animation */}
        <div key={active.id} className={styles.frame}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.url} alt={active.altText ?? title ?? ""} className={styles.image} draggable={false} />
        </div>
        {(title || description) && (
          <figcaption className={styles.caption}>
            {title && <span className={styles.captionTitle}>{title}</span>}
            {description && <span className={styles.captionText}>{description}</span>}
          </figcaption>
        )}
      </figure>

      <button type="button" autoFocus className={styles.close} onClick={onClose} aria-label="Close viewer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {hasMany && (
        <>
          <button
            type="button"
            className={`${styles.nav} ${styles.navPrev}`}
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Previous image"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.nav} ${styles.navNext}`}
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next image"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          <div className={styles.counter} aria-live="polite">
            {current + 1} / {images.length}
          </div>

          <div ref={thumbsRef} className={styles.thumbs} onClick={(e) => e.stopPropagation()}>
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                className={`${styles.thumb} ${i === current ? styles.thumbActive : ""}`}
                onClick={() => setCurrent(i)}
                aria-label={`View image ${i + 1} of ${images.length}`}
                aria-current={i === current || undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" draggable={false} loading="lazy" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
