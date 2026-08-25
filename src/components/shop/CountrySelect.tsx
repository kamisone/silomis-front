"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import styles from "./CountrySelect.module.css";

export interface CountryOption {
  isoCode: string;
  name: string;
}

/** Above this many options the panel gains a filter box; below it, the list is
 * short enough that a search field is just clutter. */
const SEARCH_THRESHOLD = 8;

/** Regional-indicator pair for a 2-letter ISO code — "FR" -> 🇫🇷. Purely
 * decorative: every row still carries its country name as text. */
function flagFor(isoCode: string): string {
  if (!/^[A-Za-z]{2}$/.test(isoCode)) return "";
  return String.fromCodePoint(...[...isoCode.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Case- and accent-insensitive, so "espana" matches "España". */
function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

interface Props {
  countries: CountryOption[];
  value: string;
  onChange: (isoCode: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  /** Labels the trigger for assistive tech — the visible <label> is the caller's. */
  ariaLabel: string;
  id?: string;
}

/**
 * Accessible country combobox: a listbox popup with type-ahead filtering,
 * full keyboard support and flag affordances, replacing the native <select>
 * whose option rows can't be styled and look out of place in checkout.
 *
 * A hidden required <input> mirrors the selection so the surrounding <form>
 * still blocks submit — the trigger is a <button>, which browsers never
 * validate.
 */
export default function CountrySelect({
  countries,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  ariaLabel,
  id,
}: Props) {
  const reactId = useId();
  const baseId = id ?? reactId;
  const listboxId = `${baseId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = countries.find((c) => c.isoCode === value) ?? null;
  const showSearch = countries.length >= SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return countries;
    // Prefix matches first — typing "ge" should surface Germany before Algeria.
    const starts = countries.filter((c) => normalize(c.name).startsWith(q));
    const contains = countries.filter((c) => !normalize(c.name).startsWith(q) && (normalize(c.name).includes(q) || c.isoCode.toLowerCase().startsWith(q)));
    return [...starts, ...contains];
  }, [countries, query]);

  function close(refocus = true) {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  }

  function commit(isoCode: string) {
    onChange(isoCode);
    close();
  }

  // Opening: start the highlight on the current selection, and move focus into
  // the filter when there is one.
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, filtered.findIndex((c) => c.isoCode === value));
    const t = setTimeout(() => {
      setActiveIndex(idx);
      if (showSearch) searchRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Filtering invalidates the old highlight index.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setActiveIndex(0), 0);
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(filtered.length - 1);
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[activeIndex]) commit(filtered[activeIndex].isoCode);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
    }
  }

  return (
    <div className={styles.root} ref={rootRef} onKeyDown={onKeyDown}>
      {/* Mirrors the selection so native form validation still applies. */}
      <input
        className={styles.validationProxy}
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        value={value}
        onChange={() => {}}
        onFocus={() => triggerRef.current?.focus()}
      />

      <button
        type="button"
        ref={triggerRef}
        id={baseId}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => (open ? close() : setOpen(true))}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
      >
        {selected ? (
          <span className={styles.value}>
            <span className={styles.flag} aria-hidden="true">
              {flagFor(selected.isoCode)}
            </span>
            <span className={styles.valueText}>{selected.name}</span>
          </span>
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}
        <ChevronDown size={17} strokeWidth={2} className={styles.chevron} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.panel}>
          {showSearch && (
            <div className={styles.searchRow}>
              <Search size={15} strokeWidth={2} className={styles.searchIcon} aria-hidden="true" />
              <input
                ref={searchRef}
                className={styles.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={listboxId}
                autoComplete="off"
              />
            </div>
          )}

          <ul className={styles.list} role="listbox" id={listboxId} aria-label={ariaLabel} ref={listRef} aria-activedescendant={filtered[activeIndex] ? `${baseId}-opt-${filtered[activeIndex].isoCode}` : undefined}>
            {filtered.length === 0 ? (
              <li className={styles.empty}>{noResultsLabel}</li>
            ) : (
              filtered.map((c, i) => {
                const isSelected = c.isoCode === value;
                return (
                  <li
                    key={c.isoCode}
                    id={`${baseId}-opt-${c.isoCode}`}
                    data-idx={i}
                    role="option"
                    aria-selected={isSelected}
                    className={`${styles.option} ${i === activeIndex ? styles.optionActive : ""} ${isSelected ? styles.optionSelected : ""}`}
                    onPointerEnter={() => setActiveIndex(i)}
                    onClick={() => commit(c.isoCode)}
                  >
                    <span className={styles.flag} aria-hidden="true">
                      {flagFor(c.isoCode)}
                    </span>
                    <span className={styles.optionName}>{c.name}</span>
                    <span className={styles.optionCode}>{c.isoCode}</span>
                    {isSelected && <Check size={15} strokeWidth={2.5} className={styles.optionCheck} aria-hidden="true" />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
