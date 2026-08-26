"use client";

import { useId } from "react";
import styles from "./Switch.module.css";

/**
 * A labelled on/off setting, laid out as a full-width row.
 *
 * The row shape is the point: a bare checkbox with a sentence of help beside it
 * wraps into an L and drags the following field out of alignment, which is what
 * these settings looked like before. Here the copy owns the left column and the
 * control is pinned right, so any number of them stack into a clean list
 * whatever the length of the explanations.
 *
 * A real <input type="checkbox"> does the work — visually hidden rather than
 * replaced, so the label association, focus order, and form semantics are the
 * browser's rather than a reimplementation.
 */
export default function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
  className,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={`${styles.row} ${disabled ? styles.rowDisabled : ""} ${className ?? ""}`}>
      <label className={styles.text} htmlFor={id}>
        <span className={styles.label}>{label}</span>
        {hint && (
          <span className={styles.hint} id={hintId}>
            {hint}
          </span>
        )}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </div>
  );
}
