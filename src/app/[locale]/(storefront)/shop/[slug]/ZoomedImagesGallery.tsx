"use client";

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
