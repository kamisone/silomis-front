"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Search, X } from "lucide-react";
import styles from "./EntityPicker.module.css";

export interface PickerOption {
  id: string;
  label: string;
  /** Optional second line — a SKU, a price, a parent category. */
  sublabel?: string | null;
  imageUrl?: string | null;
  /** Admin page for this entity. Given one, the chosen row's name becomes a
   *  link to it — the picker names things the admin often needs to go and edit,
   *  and hunting them down through the sidebar is the slow way there. Only the
   *  chosen rows link; a search result's click has to mean "pick this". */
  href?: string | null;
}

/**
 * Pick a set of things, in an order that means something.
 *
 * A plain multi-select would do the "which ones" half, but for a home-page rail
 * the sequence *is* the merchandising — so the chosen items are a list you can
 * reorder, not a bag of chips.
 *
 * The catalogue side is a dropdown that opens on focus and shows everything
 * available, scrolling, with the box above it narrowing the list. It used to
 * show nothing until you typed, on the reasoning that an admin knows the name
 * they are after — which holds for a 200-product catalogue and fails for a
 * filtered set, where the admin has no way to learn what is even eligible
 * without guessing at names.
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
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // A dropdown that only closes on blur would shut before a click on one of its
  // own rows lands, so the outside-click listener is what closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const picked = useMemo(
    // An id whose entity has since been deleted still has to render, or the
    // admin cannot see what to remove.
    () => value.map((id) => byId.get(id) ?? { id, label: id, sublabel: "No longer available" }),
    [value, byId],
  );

  /** Everything not already picked, narrowed by the box. Capped only so a
   *  pathological catalogue cannot render thousands of buttons; the list
   *  scrolls, and the count below says when the cap bit. */
  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const chosen = new Set(value);
    return options
      .filter((o) => !chosen.has(o.id))
      .filter((o) => !q || o.label.toLowerCase().includes(q) || (o.sublabel ?? "").toLowerCase().includes(q));
  }, [options, value, filter]);

  const RESULT_CAP = 200;
  const shown = matches.slice(0, RESULT_CAP);

  const atMax = max !== undefined && value.length >= max;

  function add(id: string) {
    if (atMax) return;
    onChange([...value, id]);
    setFilter("");
    // Left open: picking three products in a row is the normal case, and
    // reopening the list between each is three clicks nobody asked for.
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
              {item.href ? (
                <Link
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.chosenText} ${styles.chosenLink}`}
                  title={`Open ${item.label}`}
                >
                  <span className={styles.chosenLabel}>
                    {item.label}
                    <ExternalLink size={11} strokeWidth={2.2} className={styles.chosenLinkIcon} aria-hidden="true" />
                  </span>
                  {item.sublabel && <span className={styles.chosenSub}>{item.sublabel}</span>}
                </Link>
              ) : (
                <span className={styles.chosenText}>
                  <span className={styles.chosenLabel}>{item.label}</span>
                  {item.sublabel && <span className={styles.chosenSub}>{item.sublabel}</span>}
                </span>
              )}
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
        <div ref={boxRef}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">
              <Search size={14} strokeWidth={2.2} />
            </span>
            <input
              className={styles.search}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
              placeholder={loading ? "Loading…" : placeholder}
              disabled={disabled || loading}
              // combobox, not a bare textbox: aria-expanded only means anything
              // on a role that can be expanded, and this one now can.
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-label={placeholder}
            />
          </div>

          {open && (
            <ul id={listId} className={styles.results} role="listbox">
              {shown.length === 0 ? (
                <li className={styles.noMatch}>
                  {filter.trim() ? `Nothing matches “${filter.trim()}”.` : "Nothing left to pick."}
                </li>
              ) : (
                <>
                  {shown.map((o) => (
                    <li key={o.id}>
                      <button type="button" className={styles.result} onClick={() => add(o.id)} disabled={disabled}>
                        <Plus size={13} strokeWidth={2.6} className={styles.resultPlus} />
                        <span className={styles.resultText}>
                          <span className={styles.resultLabel}>{o.label}</span>
                          {o.sublabel && <span className={styles.resultSub}>{o.sublabel}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                  {matches.length > shown.length && (
                    <li className={styles.noMatch}>
                      {matches.length - shown.length} more — type to narrow the list.
                    </li>
                  )}
                </>
              )}
            </ul>
          )}
        </div>
      )}

      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
