"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./ProductCard.module.css";

/**
 * The image area of a product card, with a multi-image switcher.
 *
 * Split out of ProductCard so the card itself stays a server component: a rail
 * or a grid renders dozens of these, and only the image stack needs client JS.
 * Badges are passed as `children` and rendered by the server parent.
 *
 * Two interaction models, because they suit different inputs:
 *  - pointer (mouse): the image area is divided into one vertical band per
 *    image and the cursor's X position picks the band, so a single sweep walks
 *    the whole gallery without a click.
 *  - touch / small screens: prev-next arrows, since there is no hover.
 */
export default function ProductCardMedia({
  images,
  title,
  href,
  prevLabel,
  nextLabel,
  children,
}: {
  images: string[];
  title: string;
  href: string;
  prevLabel: string;
  nextLabel: string;
  children?: React.ReactNode;
}) {
  const multiImage = images.length > 1;
  const [index, setIndex] = useState(0);
  // Images past the first are left out of the DOM until the card is actually
  // interacted with. A 24-product grid would otherwise request up to 120
  // images on load, nearly all of which are never looked at.
  const [activated, setActivated] = useState(false);

  // Pointer events rather than mouse events: a tap on a touch screen fires
  // synthetic mousemove/mouseleave just before the arrow's click, which would
  // scrub to the tap position and fight the arrows. `pointerType` lets the
  // scrub apply to real mice only.
  function handleScrub(e: React.PointerEvent<HTMLDivElement>) {
    if (!multiImage || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    const next = Math.min(images.length - 1, Math.max(0, Math.floor(ratio * images.length)));
    setActivated(true);
    setIndex(next);
  }

  function handleScrubEnd(e: React.PointerEvent<HTMLDivElement>) {
    // Back to the featured image on the way out, so a grid never keeps a row
    // of cards frozen on whichever image the cursor happened to cross last.
    if (e.pointerType === "mouse") setIndex(0);
  }

  function step(e: React.MouseEvent, direction: 1 | -1) {
    // The arrows sit on top of the overlay link — stop the click reaching it.
    e.preventDefault();
    e.stopPropagation();
    setActivated(true);
    setIndex((i) => (i + direction + images.length) % images.length);
  }

  return (
    <div
      className={styles.productImageWrap}
      onPointerMove={multiImage ? handleScrub : undefined}
      onPointerLeave={multiImage ? handleScrubEnd : undefined}
    >
      {images.length > 0 ? (
        images.map(
          (url, i) =>
            (i === 0 || activated) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={i === 0 ? "" : `${title} — ${i + 1}`}
                className={`${styles.productImage} ${multiImage ? styles.productImageLayer : ""} ${
                  i === index ? "" : styles.productImageHidden
                }`}
                loading="lazy"
              />
            ),
        )
      ) : (
        <div className={styles.productImagePlaceholder} />
      )}

      {/* A link layered over the images rather than wrapping them: the arrows
          below are <button>s, and a button inside an anchor is invalid markup
          that navigates on click. Out of the tab order because the card's title
          link goes to the same place. */}
      <Link href={href} className={styles.productImageOverlay} tabIndex={-1} aria-label={title} />

      {multiImage && (
        <>
          <span className={styles.imageDots} aria-hidden="true">
            {images.map((url, i) => (
              <span key={url} className={`${styles.imageDot} ${i === index ? styles.imageDotActive : ""}`} />
            ))}
          </span>
          <button
            type="button"
            className={`${styles.imageArrow} ${styles.imageArrowLeft}`}
            onClick={(e) => step(e, -1)}
            aria-label={prevLabel}
          >
            <ChevronLeft size={16} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            className={`${styles.imageArrow} ${styles.imageArrowRight}`}
            onClick={(e) => step(e, 1)}
            aria-label={nextLabel}
          >
            <ChevronRight size={16} strokeWidth={2.25} />
          </button>
        </>
      )}

      {children}
    </div>
  );
}
