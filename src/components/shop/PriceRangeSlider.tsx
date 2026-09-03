"use client";

import { useState } from "react";
import styles from "./PriceRangeSlider.module.css";

/**
 * A dual-handle range input — two overlaid native `<input type="range">`s
 * rather than a hand-built drag surface, so each thumb keeps its own
 * keyboard focus, arrow-key stepping and screen-reader semantics for free.
 *
 * Dragging updates local state instantly for visual feedback; the commit
 * (URL push, in the caller) only fires on release/keyup, so a drag across the
 * whole track doesn't fire a navigation on every intermediate pixel.
 *
 * `valueMinCents`/`valueMaxCents` only seed the initial draft — they don't
 * stay synced after that. When the URL changes from outside this component
 * (a filter cleared elsewhere, a bookmarked link), the caller is expected to
 * remount this component with a fresh `key` rather than have it chase the
 * new props from inside a `useEffect`, which is the one thing that would
 * otherwise fight the very drag this component exists to make smooth.
 */
export default function PriceRangeSlider({
  boundsMinCents,
  boundsMaxCents,
  valueMinCents,
  valueMaxCents,
  onCommit,
  minLabel,
  maxLabel,
  formatValue,
}: {
  boundsMinCents: number;
  boundsMaxCents: number;
  valueMinCents: number;
  valueMaxCents: number;
  onCommit: (minCents: number, maxCents: number) => void;
  minLabel: string;
  maxLabel: string;
  formatValue: (cents: number) => string;
}) {
  const [draftMin, setDraftMin] = useState(valueMinCents);
  const [draftMax, setDraftMax] = useState(valueMaxCents);

  const span = Math.max(1, boundsMaxCents - boundsMinCents);
  const pctMin = ((draftMin - boundsMinCents) / span) * 100;
  const pctMax = ((draftMax - boundsMinCents) / span) * 100;

  function commit() {
    onCommit(Math.min(draftMin, draftMax), Math.max(draftMin, draftMax));
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.values}>
        <span>{formatValue(draftMin)}</span>
        <span>{formatValue(draftMax)}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.trackFill} style={{ left: `${pctMin}%`, right: `${100 - pctMax}%` }} />
        <input
          type="range"
          className={styles.thumb}
          min={boundsMinCents}
          max={boundsMaxCents}
          value={draftMin}
          aria-label={minLabel}
          onChange={(e) => setDraftMin(Math.min(Number(e.target.value), draftMax))}
          onPointerUp={commit}
          onKeyUp={commit}
        />
        <input
          type="range"
          className={styles.thumb}
          min={boundsMinCents}
          max={boundsMaxCents}
          value={draftMax}
          aria-label={maxLabel}
          onChange={(e) => setDraftMax(Math.max(Number(e.target.value), draftMin))}
          onPointerUp={commit}
          onKeyUp={commit}
        />
      </div>
    </div>
  );
}
