"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import styles from "./EntityPicker.module.css";

export interface PickerOption {
  id: string;
  label: string;
  /** Optional second line — a SKU, a price, a parent category. */
  sublabel?: string | null;
  imageUrl?: string | null;
}

/**
 * Pick a set of things, in an order that means something.
 *
 * A plain multi-select would do the "which ones" half, but for a home-page rail
 * the sequence *is* the merchandising — so the chosen items are a list you can
 * reorder, not a bag of chips. The catalogue side is a filter box rather than a
 * dropdown, because these lists run to hundreds and a shop's admin knows the
 * product's name long before they could find it by scrolling.
 */
export default function EntityPicker({
  label,
  hint,
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyLabel = "Nothing picked — the section fills itself.",
  loading = false,
  disabled = false,
  max,
}: {
  label: string;
  hint?: string;
  options: PickerOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  max?: number;
}) {
  const [filter, setFilter] = useState("");

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const picked = useMemo(
    // An id whose entity has since been deleted still has to render, or the
    // admin cannot see what to remove.
    () => value.map((id) => byId.get(id) ?? { id, label: id, sublabel: "No longer available" }),
    [value, byId],
  );

  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const chosen = new Set(value);
    return options
      .filter((o) => !chosen.has(o.id))
      .filter((o) => !q || o.label.toLowerCase().includes(q) || (o.sublabel ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [options, value, filter]);

  const atMax = max !== undefined && value.length >= max;

  function add(id: string) {
    if (atMax) return;
    onChange([...value, id]);
    setFilter("");
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className={styles.picker}>
      <div className={styles.head}>
        <span className={styles.label}>
          {label}
          <span className={`${styles.count} ${value.length ? styles.countOn : ""}`}>
            {value.length ? `${value.length}${max ? ` / ${max}` : ""} picked` : "auto"}
          </span>
        </span>
        {value.length > 0 && (
          <button type="button" className={styles.clear} onClick={() => onChange([])} disabled={disabled}>
            Clear
          </button>
        )}
      </div>

      {picked.length === 0 ? (
        <p className={styles.empty}>{emptyLabel}</p>
      ) : (
        <ol className={styles.chosen}>
          {picked.map((item, i) => (
            <li key={item.id} className={styles.chosenItem}>
              <span className={styles.rank}>{i + 1}</span>
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className={styles.thumb} />
              ) : (
                <span className={`${styles.thumb} ${styles.thumbBlank}`} aria-hidden="true" />
              )}
              <span className={styles.chosenText}>
                <span className={styles.chosenLabel}>{item.label}</span>
                {item.sublabel && <span className={styles.chosenSub}>{item.sublabel}</span>}
              </span>
              <span className={styles.chosenActions}>
                <button type="button" className={styles.iconBtn} onClick={() => move(i, -1)} disabled={i === 0 || disabled} aria-label="Move up">
                  <ArrowUp size={13} strokeWidth={2.4} />
                </button>
                <button type="button" className={styles.iconBtn} onClick={() => move(i, 1)} disabled={i === picked.length - 1 || disabled} aria-label="Move down">
                  <ArrowDown size={13} strokeWidth={2.4} />
                </button>
                <button type="button" className={styles.removeBtn} onClick={() => remove(item.id)} disabled={disabled} aria-label="Remove">
                  <X size={13} strokeWidth={2.4} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {!atMax && (
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <Search size={14} strokeWidth={2.2} />
          </span>
          <input
            className={styles.search}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={loading ? "Loading…" : placeholder}
            disabled={disabled || loading}
            aria-label={placeholder}
          />
        </div>
      )}

      {!atMax && filter.trim() && (
        <ul className={styles.results}>
          {matches.length === 0 ? (
            <li className={styles.noMatch}>Nothing matches “{filter.trim()}”.</li>
          ) : (
            matches.map((o) => (
              <li key={o.id}>
                <button type="button" className={styles.result} onClick={() => add(o.id)} disabled={disabled}>
                  <Plus size={13} strokeWidth={2.6} className={styles.resultPlus} />
                  <span className={styles.resultText}>
                    <span className={styles.resultLabel}>{o.label}</span>
                    {o.sublabel && <span className={styles.resultSub}>{o.sublabel}</span>}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
