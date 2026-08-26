"use client";

import { useState } from "react";
import styles from "./StarRatingInput.module.css";

const STARS = [1, 2, 3, 4, 5];

/**
 * Pick a whole-star rating, 1–5.
 *
 * A radiogroup rather than five buttons, so one Tab reaches the control and the
 * arrows move within it — and so a screen reader announces "3 of 5" instead of
 * five unrelated toggles. Hovering previews the value without committing it,
 * which is the affordance that makes a star row read as a rating rather than
 * decoration.
 *
 * There is no zero: the star buckets a product's rating distribution is built
 * from run 1–5, and a review with no stars has nothing to contribute to an
 * average.
 */
export default function StarRatingInput({
  value,
  onChange,
  disabled = false,
  size = 26,
  ariaLabel = "Rating",
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: number;
  ariaLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(5, value + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(1, value - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(1);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(5);
    }
  }

  return (
    <div className={styles.wrap}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={styles.stars}
        onMouseLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
      >
        {STARS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            tabIndex={n === value ? 0 : -1}
            disabled={disabled}
            className={`${styles.star} ${n <= shown ? styles.starOn : ""}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => onChange(n)}
          >
            <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        ))}
      </div>
      <span className={styles.value} aria-hidden="true">
        {shown}.0
      </span>
    </div>
  );
}
