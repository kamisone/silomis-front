"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./SearchAutocomplete.module.css";

interface Suggestion {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  priceCents: number;
  ratingAverage: number;
  reviewCount: number;
  categoryId: string | null;
  categoryName: string | null;
}

interface Group {
  key: string;
  name: string | null;
  items: Suggestion[];
}

function money(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

/**
 * Groups by category while keeping relevance order: the best match's category
 * leads, and within it the items stay in the order the search returned them.
 * Uncategorised products fall into one unlabelled group at the end rather than
 * being given an invented heading.
 */
function groupByCategory(items: Suggestion[]): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const key = item.categoryId ?? "__none";
    let group = groups.get(key);
    if (!group) {
      group = { key, name: item.categoryName, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  const all = [...groups.values()];
  return [...all.filter((g) => g.key !== "__none"), ...all.filter((g) => g.key === "__none")];
}

/** Rounded to the nearest half, drawn with a clipped overlay — no half-star
 *  glyph needed, and it stays crisp at any size. */
function Stars({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={styles.stars} aria-hidden="true">
      <span className={styles.starsBase}>★★★★★</span>
      <span className={styles.starsFill} style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

export default function SearchAutocomplete({ locale }: { locale: Locale }) {
  const t = getTranslations(locale);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      debounceRef.current = setTimeout(() => {
        setSuggestions([]);
        setSearched(false);
        setLoading(false);
        setOpen(false);
      }, 0);
      return () => clearTimeout(debounceRef.current);
    }

    // Opened and marked busy up front: a panel that appears only once results
    // land reads as a stutter, and the skeleton is what says "we heard you".
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setOpen(true);
      try {
        const res = await fetch(`/next-api/public/shop/search/autocomplete?q=${encodeURIComponent(query)}&limit=12`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(Array.isArray(data) ? data : []);
          setActive(-1);
        }
      } catch {
        // silent — autocomplete is a progressive enhancement, not required for search to work
      } finally {
        setSearched(true);
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const groups = useMemo(() => groupByCategory(suggestions), [suggestions]);
  // Arrow keys walk the panel as one list, in the order it is actually drawn.
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  function navigate(slug: string) {
    setOpen(false);
    setQuery("");
    router.push(`/${locale}/shop/${slug}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (active >= 0 && flat[active]) {
      navigate(flat[active].slug);
    } else if (query.trim()) {
      setOpen(false);
      router.push(`/${locale}/shop/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || !flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    }
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const seeAllHref = `/${locale}/shop/search?q=${encodeURIComponent(query)}`;

  return (
    <div ref={containerRef} className={styles.container}>
      <form onSubmit={submit} className={styles.search} role="search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={t.shop.searchPlaceholder}
          aria-label={t.shop.searchPlaceholder}
          className={styles.searchInput}
        />
        <button type="submit" className={styles.searchBtn} aria-label={t.shop.searchPlaceholder}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </form>

      {open && (
        <div className={styles.dropdown} role="listbox" aria-label={t.shop.searchResultsFor}>
          {loading && (
            <div className={styles.grid} aria-hidden="true">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={styles.skeleton}>
                  <span className={styles.skelThumb} />
                  <span className={styles.skelLines}>
                    <span className={styles.skelLine} />
                    <span className={`${styles.skelLine} ${styles.skelLineShort}`} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {!loading && searched && flat.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{t.shop.noResults}</p>
              <p className={styles.emptyHint}>{t.shop.noResultsTry}</p>
            </div>
          )}

          {!loading &&
            groups.map((group) => (
              <section key={group.key} className={`${styles.group} ${group.name ? "" : styles.groupPlain}`}>
                {group.name && (
                  <header className={styles.groupHead}>
                    <h3 className={styles.groupName}>{group.name}</h3>
                    <span className={styles.groupCount}>
                      {group.items.length}{" "}
                      {group.items.length === 1 ? t.shop.resultSingularCount : t.shop.resultPluralCount}
                    </span>
                  </header>
                )}
                <div className={styles.grid}>
                  {group.items.map((s) => {
                    const index = flat.indexOf(s);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        aria-selected={index === active}
                        onMouseDown={() => navigate(s.slug)}
                        onMouseEnter={() => setActive(index)}
                        className={`${styles.card} ${index === active ? styles.cardActive : ""}`}
                      >
                        <span className={styles.thumb}>
                          {s.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.imageUrl} alt="" className={styles.thumbImg} loading="lazy" />
                          ) : (
                            <span className={styles.thumbBlank} aria-hidden="true" />
                          )}
                        </span>
                        <span className={styles.cardBody}>
                          {s.brand && <span className={styles.cardBrand}>{s.brand}</span>}
                          <span className={styles.cardTitle}>{s.title}</span>
                          {/* Only shown once there is something to show — an
                              empty star row reads as a zero score, which is a
                              worse signal than no score at all. */}
                          {s.reviewCount > 0 && (
                            <span className={styles.cardRating}>
                              <Stars value={s.ratingAverage} />
                              <span className={styles.ratingCount}>
                                {s.ratingAverage.toFixed(1)} ({s.reviewCount})
                              </span>
                            </span>
                          )}
                          <span className={styles.cardPrice}>{money(s.priceCents)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

          {!loading && flat.length > 0 && (
            <a href={seeAllHref} className={styles.seeAll}>
              <span>
                {t.shop.seeAllResultsFor} &ldquo;{query}&rdquo;
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
