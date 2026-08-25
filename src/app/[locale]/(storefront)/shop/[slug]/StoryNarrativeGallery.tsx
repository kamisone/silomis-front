"use client";

import { useEffect, useRef, useState } from "react";
import ImageLightbox from "@/components/shop/ImageLightbox";
import StoryLazyImage from "./StoryLazyImage";
import type { StoryGalleryItem } from "./StorySideGallery";
import styles from "./StoryGallery.module.css";

/**
 * Location 2 — Narrative Gallery.
 * Premium storytelling section rendered after all product sections: each
 * image is paired with its localized title and description in alternating
 * rows, with a per-row scroll reveal.
 */

function NarrativeRow({ item, index, onOpen }: { item: StoryGalleryItem; index: number; onOpen: () => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const reversed = index % 2 === 1;
  const hasCopy = !!(item.title?.trim() || item.description?.trim());

  return (
    <div
      ref={rowRef}
      className={[styles.narrativeRow, reversed ? styles.narrativeRowReversed : "", revealed ? styles.narrativeRowRevealed : ""].join(" ")}
    >
      <figure
        className={styles.narrativeMedia}
        style={{ aspectRatio: (item.aspectRatio ?? "1:1").replace(":", "/") }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={item.title?.trim() || item.altText || `${index + 1}`}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <StoryLazyImage src={item.url} alt={item.altText ?? item.title ?? ""} />
      </figure>

      {hasCopy && (
        <div className={styles.narrativeCopy}>
          {item.title?.trim() && <h3 className={styles.narrativeHeading}>{item.title}</h3>}
          {item.description?.trim() && <p className={styles.narrativeText}>{item.description}</p>}
        </div>
      )}
    </div>
  );
}

export default function StoryNarrativeGallery({
  items,
  ariaLabel,
  overline,
}: {
  items: StoryGalleryItem[];
  ariaLabel: string;
  /** Admin-managed heading — hidden when empty. */
  overline?: string | null;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <section className={styles.narrativeSection} aria-label={ariaLabel}>
      <div className={styles.narrativeInner}>
        {overline?.trim() && <h2 className={styles.narrativeOverline}>{overline}</h2>}
        {items.map((item, i) => (
          <NarrativeRow key={item.id} item={item} index={i} onOpen={() => setLightboxIndex(i)} />
        ))}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox images={items} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} ariaLabel={ariaLabel} />
      )}
    </section>
  );
}
