"use client";

import type { getTranslations } from "@/lib/i18n";
import styles from "./ReviewsSummaryCard.module.css";

interface Stats {
  average: number;
  count: number;
  distribution?: Record<string, number>;
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
 * fetches nothing.
 *
 * Only the score, the star split and a link down: the reviews themselves
 * (photos, quotes) are read in the full section at the bottom of the page.
 */
export default function ReviewsSummaryCard({
  stats,
  t,
}: {
  stats: Stats;
  t: ReturnType<typeof getTranslations>;
}) {
  const distribution = stats.distribution ?? {};

  // Bars are read against the total, not against the biggest bucket: "most of
  // them are five stars" is the shape a shopper is looking for, and scaling to
  // the tallest bar would make a 3-vs-2 split look identical to 300-vs-200.
  // Five additions — cheaper than the memo that would have to guard it.
  const totalRated = [1, 2, 3, 4, 5].reduce((sum, n) => sum + (distribution[String(n)] ?? 0), 0);

  if (stats.count === 0) return null;

  function scrollToAll() {
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className={styles.card} aria-label={t.shop.reviewsHeading}>
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

      <button type="button" className={styles.readMore} onClick={scrollToAll}>
        {t.shop.reviewsReadMore}
      </button>
    </section>
  );
}
