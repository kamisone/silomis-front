"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCardVariant } from "./ProductCardVariantContext";
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
 *
 * When the card's variation picker resolves to an option with its own photo,
 * that photo joins the gallery and becomes the shown one. It is added rather
 * than substituted: clicking "Black" is a request to see black, but the rest
 * of the product's photos are still worth scrubbing through afterwards, and
 * the arrows and dots keep working across the whole set.
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
  const variantImage = useCardVariant()?.activeImageUrl ?? null;

  // The variant photo is often already one of the product's gallery images —
  // then picking the option just moves to it. When it is not (a colour shot
  // attached only to the variant), it is prepended so it is still reachable
  // with the arrows once the shopper scrubs away.
  const gallery = useMemo(
    () => (variantImage && !images.includes(variantImage) ? [variantImage, ...images] : images),
    [variantImage, images],
  );
  const variantIndex = variantImage ? gallery.indexOf(variantImage) : -1;

  const multiImage = gallery.length > 1;
  const [index, setIndex] = useState(0);
  // Images past the first are left out of the DOM until the card is actually
  // interacted with. A 24-product grid would otherwise request up to 120
  // images on load, nearly all of which are never looked at.
  const [activated, setActivated] = useState(false);

  // Jumping to the newly picked option's photo is a render-phase adjustment,
  // not an effect: it is derived from a prop change and an effect would paint
  // the old image for a frame first. Tracking the previous value is what makes
  // it run once per change, leaving the shopper free to scrub away afterwards.
  const [lastVariantImage, setLastVariantImage] = useState(variantImage);
  if (variantImage !== lastVariantImage) {
    setLastVariantImage(variantImage);
    if (variantIndex >= 0) {
      setIndex(variantIndex);
      // The prepended photo pushes every other image up one slot, so the rest
      // of the gallery has to be in the DOM for the switch to land.
      setActivated(true);
    }
  }

  // Pointer events rather than mouse events: a tap on a touch screen fires
  // synthetic mousemove/mouseleave just before the arrow's click, which would
  // scrub to the tap position and fight the arrows. `pointerType` lets the
  // scrub apply to real mice only.
  function handleScrub(e: React.PointerEvent<HTMLDivElement>) {
    if (!multiImage || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    const next = Math.min(gallery.length - 1, Math.max(0, Math.floor(ratio * gallery.length)));
    setActivated(true);
    setIndex(next);
  }

  function handleScrubEnd(e: React.PointerEvent<HTMLDivElement>) {
    // Back to the resting image on the way out, so a grid never keeps a row of
    // cards frozen on whichever image the cursor happened to cross last. That
    // is the picked option's photo when there is one — returning to the
    // featured shot would silently undo the shopper's choice.
    if (e.pointerType === "mouse") setIndex(variantIndex >= 0 ? variantIndex : 0);
  }

  function step(e: React.MouseEvent, direction: 1 | -1) {
    // The arrows sit on top of the overlay link — stop the click reaching it.
    e.preventDefault();
    e.stopPropagation();
    setActivated(true);
    setIndex((i) => (i + direction + gallery.length) % gallery.length);
  }

  return (
    <div
      className={styles.productImageWrap}
      onPointerMove={multiImage ? handleScrub : undefined}
      onPointerLeave={multiImage ? handleScrubEnd : undefined}
    >
      {gallery.length > 0 ? (
        gallery.map(
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
            {gallery.map((url, i) => (
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
