"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./BlogProductPicker.module.css";

export interface BlogProductRef {
  productId: string;
  label: string;
  /** Display-only, hydrated from the API — never sent back on save. */
  title: string;
  imageUrl: string | null;
  status?: string;
}

interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  status: string;
  featuredImageUrl: string | null;
}

interface Props {
  value: BlogProductRef[];
  onChange: (next: BlogProductRef[]) => void;
}

const MAX_REFS = 24;

/**
 * Picks the shop products featured in an article. Search hits the existing
 * admin product list endpoint rather than a bespoke one — it already filters
 * soft-deleted rows and resolves image URLs.
 */
export default function BlogProductPicker({ value, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AdminProduct[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search — empty input shows the most recent products so the
  // admin can pick without having to guess a title first.
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "8" });
      if (search.trim()) params.set("search", search.trim());
      api
        .get<{ items: AdminProduct[] }>(`/next-api/admin/shop/products?${params}`)
        .then((d) => setResults(d.items))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Close the results dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selectedIds = new Set(value.map((r) => r.productId));
  const atMax = value.length >= MAX_REFS;

  function add(product: AdminProduct) {
    if (selectedIds.has(product.id) || atMax) return;
    onChange([
      ...value,
      {
        productId: product.id,
        label: "",
        title: product.title,
        imageUrl: product.featuredImageUrl,
        status: product.status,
      },
    ]);
    setSearch("");
    setOpen(false);
  }

  function remove(productId: string) {
    onChange(value.filter((r) => r.productId !== productId));
  }

  function setLabel(productId: string, label: string) {
    onChange(value.map((r) => (r.productId === productId ? { ...r, label } : r)));
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...value];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className={styles.picker}>
      {value.length === 0 && (
        <p className={styles.empty}>
          No products linked yet — search below to feature products in this article.
        </p>
      )}

      {value.length > 0 && (
        <ul className={styles.list}>
          {value.map((ref, i) => (
            <li key={ref.productId} className={styles.row}>
              <div className={styles.thumb}>
                {ref.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ref.imageUrl} alt="" className={styles.thumbImg} />
                ) : (
                  <div className={styles.thumbPlaceholder} />
                )}
              </div>

              <div className={styles.rowBody}>
                <div className={styles.rowTitle}>
                  {ref.title}
                  {ref.status && ref.status !== "active" && (
                    <span className={styles.statusWarn} title="Only active products appear on the published article">
                      {ref.status}
                    </span>
                  )}
                </div>
                <input
                  className={styles.labelInput}
                  value={ref.label}
                  onChange={(e) => setLabel(ref.productId, e.target.value)}
                  placeholder="Optional caption shown under the card"
                  maxLength={300}
                />
              </div>

              <div className={styles.rowActions}>
                <button type="button" className={styles.iconBtn} disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={i === value.length - 1}
                  onClick={() => move(i, 1)}
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </button>
                <button type="button" className={styles.removeBtn} onClick={() => remove(ref.productId)} title="Remove">
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.searchWrap} ref={boxRef}>
        <div className={styles.searchField}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={atMax ? `Maximum of ${MAX_REFS} products reached` : "Search products to feature…"}
            disabled={atMax}
          />
        </div>

        {open && !atMax && (
          <div className={styles.results}>
            {loading ? (
              <div className={styles.resultEmpty}>Searching…</div>
            ) : results.length === 0 ? (
              <div className={styles.resultEmpty}>No products found.</div>
            ) : (
              results.map((p) => {
                const already = selectedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.result}
                    onClick={() => add(p)}
                    disabled={already}
                  >
                    <div className={styles.resultThumb}>
                      {p.featuredImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.featuredImageUrl} alt="" className={styles.thumbImg} />
                      ) : (
                        <div className={styles.thumbPlaceholder} />
                      )}
                    </div>
                    <span className={styles.resultTitle}>{p.title}</span>
                    {already && <span className={styles.resultAdded}>added</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <p className={ui.muted} style={{ fontSize: "0.78rem" }}>
        Shown as cards at the end of the article · {value.length}/{MAX_REFS}
      </p>
    </div>
  );
}
