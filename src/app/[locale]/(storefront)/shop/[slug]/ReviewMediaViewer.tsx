"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { toBcp47, type getTranslations, type Locale } from "@/lib/i18n";
import type { ReviewItem } from "./ReviewsSection";
import styles from "./ReviewMediaViewer.module.css";

/** Which review — and optionally which of its pictures — to open on. */
export interface ViewerTarget {
  reviewId: string;
  mediaKey?: string;
}

interface Entry {
  media: ReviewItem["media"][number];
  review: ReviewItem;
}

function avatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className={styles.stars} role="img" aria-label={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={16} height={16} viewBox="0 0 24 24" fill="currentColor" className={n <= rating ? styles.starOn : styles.starOff}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Full-screen viewer for the photos customers attached to their reviews.
 *
 * The rail pages across *every* picture on the product, not just the ones on
 * the review that was clicked — someone who opens a photo is browsing what the
 * thing actually looks like, and making them close and reopen per review would
 * fight that. The panel beside it swaps to whichever review owns the current
 * picture, so the quote and the photo always belong together.
 *
 * A review with no photos still opens here: its text is the whole content and
 * the media column is simply absent, which beats a click that does nothing.
 */
export default function ReviewMediaViewer({
  reviews,
  target,
  onClose,
  locale,
  t,
}: {
  reviews: ReviewItem[];
  target: ViewerTarget;
  onClose: () => void;
  locale: Locale;
  t: ReturnType<typeof getTranslations>;
}) {
  const entries = useMemo<Entry[]>(
    () => reviews.flatMap((review) => review.media.map((media) => ({ media, review }))),
    [reviews],
  );

  const initialIndex = useMemo(() => {
    if (target.mediaKey) {
      const exact = entries.findIndex((e) => e.media.key === target.mediaKey);
      if (exact >= 0) return exact;
    }
    return entries.findIndex((e) => e.review.id === target.reviewId);
  }, [entries, target]);

  const [index, setIndex] = useState(Math.max(0, initialIndex));

  // A review with no pictures of its own — the viewer becomes a reader.
  const textOnlyReview = initialIndex < 0 ? reviews.find((r) => r.id === target.reviewId) ?? null : null;
  const current = textOnlyReview ? null : entries[index];
  const review = textOnlyReview ?? current?.review ?? null;

  const overlayRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  // Where focus came from, so closing puts it back rather than dropping the
  // keyboard user at the top of the document.
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const go = useCallback(
    (delta: 1 | -1) => setIndex((i) => Math.min(entries.length - 1, Math.max(0, i + delta))),
    [entries.length],
  );

  useEffect(() => {
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    overlayRef.current?.focus();
    return () => restoreFocusTo.current?.focus?.();
  }, []);

  // The page behind must not scroll while this is open, and restoring the exact
  // previous value avoids stomping on whatever set it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // Keep the active thumbnail in view when the arrows walk past the fold.
  useEffect(() => {
    railRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [index]);

  if (!review) return null;

  const photosInReview = review.media.length;
  const positionInReview = current ? review.media.findIndex((m) => m.key === current.media.key) + 1 : 0;

  const date = new Date(review.createdAt).toLocaleDateString(toBcp47(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const thumbs = current && entries.length > 1 && (
    <div className={styles.rail} ref={railRef} role="tablist" aria-label={t.shop.reviewsHeading}>
      {entries.map((e, i) => (
        <button
          key={`${e.review.id}-${e.media.key}`}
          type="button"
          role="tab"
          data-index={i}
          aria-selected={i === index}
          aria-label={`${i + 1} / ${entries.length}`}
          className={`${styles.thumb} ${i === index ? styles.thumbActive : ""}`}
          onClick={() => setIndex(i)}
        >
          {e.media.type === "video" ? (
            <>
              <video src={e.media.url} muted playsInline className={styles.thumbMedia} />
              <span className={styles.thumbPlay} aria-hidden="true">
                <Play size={11} fill="currentColor" />
              </span>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.media.url} alt="" loading="lazy" className={styles.thumbMedia} />
          )}
        </button>
      ))}
    </div>
  );

  return createPortal(
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t.shop.reviewsHeading}
      tabIndex={-1}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`${styles.surface} ${current ? "" : styles.surfaceTextOnly}`}>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t.shop.reviewClose}>
          <X size={17} strokeWidth={2.4} />
        </button>

        {thumbs}

        {current && (
          <div className={styles.stage}>
            {current.media.type === "video" ? (
              <video
                key={current.media.key}
                src={current.media.url}
                controls
                autoPlay
                playsInline
                className={styles.stageMedia}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={current.media.key}
                src={current.media.url}
                alt={current.media.altText ?? `${index + 1} / ${entries.length}`}
                className={styles.stageMedia}
              />
            )}
          </div>
        )}

        <div className={styles.panel}>
          <div className={styles.panelScroll}>
            <div className={styles.panelHead}>
              <Stars rating={review.rating} />
              {review.isVerifiedPurchase && (
                <span className={styles.verified}>
                  <BadgeCheck size={13} strokeWidth={2} />
                  {t.shop.reviewVerifiedBadge}
                </span>
              )}
            </div>
            {review.title && <p className={styles.panelTitle}>{review.title}</p>}
            {review.body && <p className={styles.panelBody}>{review.body}</p>}
          </div>

          <div className={styles.author}>
            <span
              className={styles.avatar}
              style={{ background: `hsl(${avatarHue(review.authorName)} 45% 62%)` }}
              aria-hidden="true"
            >
              {review.authorName.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <span className={styles.authorName}>
              {review.authorName} · {date}
            </span>
          </div>

          {/* Paging is per photo, not per review: a review can carry several,
              and the rail shows them individually. Stepping past the last one
              moves on to the next review, and the panel above follows. */}
          {current && entries.length > 1 && (
            <div className={styles.navRow}>
              <span className={styles.counter}>
                {index + 1} / {entries.length}
                {photosInReview > 1 && (
                  <span className={styles.counterSub}>
                    {" "}
                    · {positionInReview}/{photosInReview}
                  </span>
                )}
              </span>
              <span className={styles.navButtons}>
                <button
                  type="button"
                  className={styles.nav}
                  onClick={() => go(-1)}
                  disabled={index === 0}
                  aria-label={t.shop.prevImage}
                >
                  <ChevronLeft size={19} strokeWidth={2.6} />
                </button>
                <button
                  type="button"
                  className={styles.nav}
                  onClick={() => go(1)}
                  disabled={index === entries.length - 1}
                  aria-label={t.shop.nextImage}
                >
                  <ChevronRight size={19} strokeWidth={2.6} />
                </button>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
