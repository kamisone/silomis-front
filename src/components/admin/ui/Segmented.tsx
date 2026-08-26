"use client";

import { useRef, type ReactNode } from "react";
import styles from "./Segmented.module.css";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  /** Shown on hover / to screen readers when the label is an abbreviation. */
  title?: string;
  icon?: ReactNode;
}

/**
 * A small set of mutually exclusive choices, all visible at once.
 *
 * Used where a Select would be the wrong shape: with two or three short options
 * — Left / Centred, Small / Medium / Large — a dropdown hides the answer behind
 * a click and costs a menu round-trip to change something the eye could have
 * compared directly. The rule of thumb applied here is four options or fewer,
 * each a word long.
 *
 * Implemented as a radiogroup with roving tabindex: one tab stop for the whole
 * control, arrows move between options, which is what a radio group does
 * natively and what a row of buttons would otherwise get wrong.
 */
export default function Segmented<T extends string = string>({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  labelledBy,
  className,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
  labelledBy?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function focusAt(index: number) {
    const n = options.length;
    const target = ((index % n) + n) % n;
    onChange(options[target].value);
    ref.current?.querySelectorAll<HTMLButtonElement>("[role='radio']")[target]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusAt(0);
        break;
      case "End":
        e.preventDefault();
        focusAt(options.length - 1);
        break;
    }
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      className={`${styles.group} ${className ?? ""}`}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            // Roving tabindex: only the selected option is in the tab order, so
            // Tab crosses the whole control in one press.
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            title={option.title ?? option.label}
            className={`${styles.option} ${active ? styles.optionActive : ""}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {option.icon && <span className={styles.icon}>{option.icon}</span>}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
