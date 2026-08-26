"use client";

import { useMemo, useState } from "react";
import { toBcp47, type getTranslations, type Locale } from "@/lib/i18n";
import type { ReviewItem } from "./ReviewsSection";
import ReviewMediaViewer, { type ViewerTarget } from "./ReviewMediaViewer";
import styles from "./ReviewsSummaryCard.module.css";

interface Stats {
  average: number;
  count: number;
  distribution?: Record<string, number>;
}

/** Deterministic hue per name, so a given reviewer keeps the same avatar colour
 *  between renders and between server and client. */
function avatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/**
 * A row of five stars filled to a fractional rating.
 *
 * The filled row is laid over the outline row and clipped by width, which is
 * what lets 4.6 render as four and a bit rather than being rounded to five —
 * on a summary the difference between those two is the whole point of showing
 * a decimal beside it.
 */
function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const row = (filled: boolean) => (
    <span className={filled ? styles.starsFill : styles.starsBase} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
  return (
    <span className={styles.stars} role="img" aria-label={`${rating.toFixed(1)} out of 5`}>
      {row(false)}
      <span className={styles.starsClip} style={{ width: `${pct}%` }}>
        {row(true)}
      </span>
    </span>
  );
}

/**
 * The reviews summary in the buy column, above the long description.
 *
 * Placed there because rating is a buying signal and the description is where
 * attention starts to drop — a shopper deciding between two products wants the
 * score before the copy, not after it. It repeats data the full section at the
 * bottom already renders, so it deliberately holds no state of its own and
 * fetches nothing: the page already loaded the first page of reviews for the
 * section below, and this reads the same props.
 */
export default function ReviewsSummaryCard({
  stats,
  reviews,
  locale,
  t,
}: {
  stats: Stats;
  reviews: ReviewItem[];
  locale: Locale;
  t: ReturnType<typeof getTranslations>;
}) {
  const [viewerTarget, setViewerTarget] = useState<ViewerTarget | null>(null);

  const distribution = stats.distribution ?? {};

  // Bars are read against the total, not against the biggest bucket: "most of
  // them are five stars" is the shape a shopper is looking for, and scaling to
  // the tallest bar would make a 3-vs-2 split look identical to 300-vs-200.
  // Five additions — cheaper than the memo that would have to guard it.
  const totalRated = [1, 2, 3, 4, 5].reduce((sum, n) => sum + (distribution[String(n)] ?? 0), 0);

  const mediaStrip = useMemo(
    () =>
      reviews
        .flatMap((r) => r.media.filter((m) => m.type === "image").map((m) => ({ media: m, reviewId: r.id })))
        .slice(0, 10),
    [reviews],
  );

  // A card with nothing written on it is a name and a star row — that reads as
  // filler next to ones that have something to say, so quotes come first.
  const cards = useMemo(
    () => [...reviews].sort((a, b) => (b.body?.length ?? 0) - (a.body?.length ?? 0)).slice(0, 8),
    [reviews],
  );

  if (stats.count === 0) return null;

  function scrollToAll() {
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className={styles.card} aria-labelledby="reviews-summary-heading">
      <h2 id="reviews-summary-heading" className={styles.heading}>
        {t.shop.reviewsHeading}
      </h2>

      <div className={styles.summary}>
        <div className={styles.score}>
          <span className={styles.average}>{stats.average.toFixed(1)}</span>
          <Stars rating={stats.average} size={17} />
          <span className={styles.count}>
            {stats.count} {stats.count === 1 ? t.shop.reviewCountSingular : t.shop.reviewCountPlural}
          </span>
        </div>

        <div className={styles.bars}>
          {[5, 4, 3, 2, 1].map((n) => {
            const count = distribution[String(n)] ?? 0;
            return (
              <div key={n} className={styles.barRow}>
                <span className={styles.barLabel}>{n}</span>
                <span className={styles.barTrack}>
                  <span
                    className={styles.barFill}
                    style={{ width: totalRated ? `${(count / totalRated) * 100}%` : "0%" }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {mediaStrip.length > 0 && (
        <div className={styles.mediaStrip}>
          {mediaStrip.map(({ media, reviewId }) => (
            <button
              /* Scoped to the review: this strip is flattened across reviews,
                 and two shoppers photographing the same thing can upload the
                 same asset, which made the media key alone non-unique here. */
              key={`${reviewId}-${media.key}`}
              type="button"
              className={styles.mediaTile}
              onClick={() => setViewerTarget({ reviewId, mediaKey: media.key })}
              aria-label={t.shop.reviewsReadMore}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={media.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {cards.length > 0 && (
        <ul className={styles.cards}>
          {cards.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={styles.reviewCard}
                onClick={() => setViewerTarget({ reviewId: r.id })}
                aria-label={`${r.authorName} — ${r.rating}/5`}
              >
                <Stars rating={r.rating} size={12} />
                {r.title && <p className={styles.reviewTitle}>{r.title}</p>}
                {r.body && <p className={styles.reviewBody}>{r.body}</p>}
                <div className={styles.reviewer}>
                  <span
                    className={styles.avatar}
                    style={{ background: `hsl(${avatarHue(r.authorName)} 45% 62%)` }}
                    aria-hidden="true"
                  >
                    {initial(r.authorName)}
                  </span>
                  <span className={styles.reviewerName}>
                    {r.authorName} · {new Date(r.createdAt).toLocaleDateString(toBcp47(locale), { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={styles.readMore} onClick={scrollToAll}>
        {t.shop.reviewsReadMore}
      </button>

      {viewerTarget && (
        <ReviewMediaViewer
          reviews={reviews}
          target={viewerTarget}
          onClose={() => setViewerTarget(null)}
          locale={locale}
          t={t}
        />
      )}
    </section>
  );
}
