"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageOff, Search, X } from "lucide-react";
import styles from "./ProductPicker.module.css";

interface ProductOption {
  id: string;
  title: string;
  slug?: string;
  sku?: string | null;
  status?: string;
  basePriceCents?: number | null;
  featuredImageUrl?: string | null;
}

/**
 * Type-to-search product filter.
 *
 * A combobox rather than a `<select>` of every product: a catalogue does not
 * fit in a dropdown, and the admin already knows the name of the product they
 * are looking for. While open with nothing chosen it always shows a list — a
 * first page when the box is empty, live results as they type — so it is
 * browsable as well as searchable.
 */
export default function ProductPicker({
  value,
  onChange,
  label = "Product",
  placeholder = "Search products…",
  scope,
  excludeIds,
  withThumbnails = false,
  className,
}: {
  /**
   * The chosen product. Leave it permanently empty for an "add" control: the
   * chip below only renders for a held value, so a parent that acts on the
   * pick and never feeds one back gets a box that resets and stays ready for
   * the next one.
   */
  value: string;
  onChange: (productId: string) => void;
  label?: string;
  placeholder?: string;
  /** Narrows the list to test products, or to everything except them. */
  scope?: "test" | "live";
  /** Products already chosen elsewhere — dropped from the list rather than
   *  offered and then rejected. */
  excludeIds?: readonly string[];
  /** Richer rows: image, price and status. Worth it where the pick is a
   *  commitment; noise where it is a filter. */
  withThumbnails?: boolean;
  className?: string;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProductOption[]>([]);
  const [open, setOpen] = useState(false);
  // Keyed by the id it belongs to, so a title left over from a previous
  // selection is never shown against the current one. Derived on read rather
  // than cleared in the effect below — clearing there is a synchronous
  // setState in an effect body, which is a cascading render.
  const [titleFor, setTitleFor] = useState<{ id: string; title: string } | null>(null);
  const selectedTitle = titleFor?.id === value ? titleFor.title : "";
  const boxRef = useRef<HTMLDivElement>(null);

  // Resolves the chosen product's title from its id, so the control still
  // reads as a name when the value arrives from outside (a restored filter).
  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    fetch(`/next-api/admin/shop/products/${value}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!cancelled && p?.title) setTitleFor({ id: value, title: p.title });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value]);

  // The menu only renders while open with nothing chosen, so results left in
  // state at other times are never displayed and need no clearing here.
  const menuOpen = open && !value;

  // A Set keyed by content, so a parent passing a fresh array each render does
  // not restart the search on every keystroke of its own state.
  const excludeKey = excludeIds?.join(",") ?? "";
  const exclude = useMemo(() => new Set(excludeKey ? excludeKey.split(",") : []), [excludeKey]);
  useEffect(() => {
    if (!menuOpen) return;
    let cancelled = false;
    const q = term.trim();
    // An empty box loads its first page straight away; typing is debounced so
    // a request does not go out per keystroke.
    const handle = setTimeout(
      () => {
        const params = new URLSearchParams({ limit: "10" });
        if (q) params.set("search", q);
        if (scope) params.set("isTestProduct", scope === "test" ? "true" : "false");
        fetch(`/next-api/admin/shop/products?${params.toString()}`)
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .then((data) => {
            if (cancelled) return;
            const items: ProductOption[] = Array.isArray(data) ? data : (data.items ?? []);
            setResults(exclude.size ? items.filter((p) => !exclude.has(p.id)) : items);
          })
          .catch(() => {
            if (!cancelled) setResults([]);
          });
      },
      q ? 250 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [term, menuOpen, scope, exclude]);

  // Clicking outside closes the list without choosing anything.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(p: ProductOption) {
    onChange(p.id);
    setTitleFor({ id: p.id, title: p.title });
    setTerm("");
    setOpen(false);
  }

  function clear() {
    onChange("");
    setTerm("");
  }

  return (
    <div className={`${styles.root} ${className ?? ""}`} ref={boxRef}>
      <span className={styles.label}>{label}</span>

      {value ? (
        // Chosen state is a chip, not a filled text box: the filter is set, and
        // an editable field there invites typing that would do nothing.
        <div className={styles.chosen}>
          <span className={styles.chosenTitle} title={selectedTitle || value}>
            {selectedTitle || "…"}
          </span>
          <button type="button" className={styles.clear} onClick={clear} aria-label={`Clear ${label} filter`}>
            <X size={13} strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        <div className={styles.field}>
          <Search size={13} strokeWidth={2.2} className={styles.searchIcon} aria-hidden="true" />
          <input
            className={styles.input}
            value={term}
            placeholder={placeholder}
            onChange={(e) => setTerm(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && results.length) {
                e.preventDefault();
                choose(results[0]);
              }
            }}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${label}-picker-list`}
            aria-autocomplete="list"
          />
        </div>
      )}

      {menuOpen && (
        <ul className={styles.menu} id={`${label}-picker-list`} role="listbox">
          {results.length === 0 ? (
            <li className={styles.empty}>No products found</li>
          ) : (
            results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={withThumbnails ? styles.optionRich : styles.option}
                  role="option"
                  aria-selected={false}
                  onClick={() => choose(p)}
                >
                  {withThumbnails ? (
                    <>
                      {p.featuredImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.featuredImageUrl} alt="" className={styles.thumb} loading="lazy" />
                      ) : (
                        <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true">
                          <ImageOff size={13} strokeWidth={2} />
                        </span>
                      )}
                      <span className={styles.optionText}>
                        <span className={styles.optionTitle}>{p.title}</span>
                        <span className={styles.optionMeta}>
                          {p.sku ? <span>{p.sku}</span> : null}
                          {typeof p.basePriceCents === "number" ? <span>{(p.basePriceCents / 100).toFixed(2)} €</span> : null}
                          {p.status && p.status !== "active" ? <span className={styles.optionStatus}>{p.status}</span> : null}
                        </span>
                      </span>
                    </>
                  ) : (
                    p.title
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
