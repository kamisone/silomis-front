"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "@/components/admin/blog/BlogProductPicker.module.css";

/** Display-only fields are hydrated from the API; only ids are sent on save. */
export interface ProductArticleRef {
  postId: string;
  title: string;
  slug: string;
  status?: string;
}

interface AdminPost {
  id: string;
  title: string;
  slug: string;
  status: string;
}

const MAX_REFS = 24;

/**
 * Picks the articles shown at the foot of a product page.
 *
 * The mirror image of what the blog editor used to own: the same
 * BlogProductReference join, written from the product's side. Articles are
 * picked, never written here — an article has to exist before a product can
 * point at it.
 *
 * Shares BlogProductPicker's stylesheet rather than copying it: it is the same
 * control with the two ends swapped, and two stylesheets would drift.
 */
export default function ProductArticlePicker({
  value,
  onChange,
}: {
  value: ProductArticleRef[];
  onChange: (next: ProductArticleRef[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AdminPost[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced; an empty box lists the most recent articles so the admin can
  // pick without having to remember a title first.
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "8" });
      if (search.trim()) params.set("search", search.trim());
      api
        .get<{ items: AdminPost[] } | AdminPost[]>(`/next-api/admin/blog/posts?${params}`)
        .then((d) => setResults(Array.isArray(d) ? d : (d?.items ?? [])))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selectedIds = new Set(value.map((r) => r.postId));
  const atMax = value.length >= MAX_REFS;

  function add(post: AdminPost) {
    if (selectedIds.has(post.id) || atMax) return;
    onChange([...value, { postId: post.id, title: post.title, slug: post.slug, status: post.status }]);
    setSearch("");
    setOpen(false);
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
        <p className={styles.empty}>No articles linked yet — search below to show articles on this product&rsquo;s page.</p>
      )}

      {value.length > 0 && (
        <ul className={styles.list}>
          {value.map((ref, i) => (
            <li key={ref.postId} className={styles.row}>
              <div className={styles.rowBody}>
                <div className={styles.rowTitle}>
                  {ref.title}
                  {ref.status && ref.status !== "published" && (
                    <span className={styles.statusWarn} title="Only published articles appear on the product page">
                      {ref.status}
                    </span>
                  )}
                </div>
                <span className={ui.muted} style={{ fontSize: "0.76rem" }}>
                  /blog/{ref.slug}
                </span>
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
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => onChange(value.filter((r) => r.postId !== ref.postId))}
                  title="Remove"
                >
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
            placeholder={atMax ? `Maximum of ${MAX_REFS} articles reached` : "Search articles to link…"}
            disabled={atMax}
          />
        </div>

        {open && !atMax && (
          <div className={styles.results}>
            {loading ? (
              <div className={styles.resultEmpty}>Searching…</div>
            ) : results.length === 0 ? (
              <div className={styles.resultEmpty}>No articles found.</div>
            ) : (
              results.map((p) => {
                const already = selectedIds.has(p.id);
                return (
                  <button key={p.id} type="button" className={styles.result} onClick={() => add(p)} disabled={already}>
                    <span className={styles.resultTitle}>{p.title}</span>
                    {p.status !== "published" && <span className={styles.resultAdded}>{p.status}</span>}
                    {already && <span className={styles.resultAdded}>added</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <p className={ui.muted} style={{ fontSize: "0.78rem" }}>
        Shown at the end of the product page · {value.length}/{MAX_REFS}
      </p>
    </div>
  );
}
