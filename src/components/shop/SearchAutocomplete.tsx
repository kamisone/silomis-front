"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./SearchAutocomplete.module.css";

interface Suggestion {
  id: string;
  slug: string;
  title: string;
}

export default function SearchAutocomplete({ locale }: { locale: Locale }) {
  const t = getTranslations(locale);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      debounceRef.current = setTimeout(() => {
        setSuggestions([]);
        setOpen(false);
      }, 0);
      return () => clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/next-api/public/shop/search/autocomplete?q=${encodeURIComponent(query)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(Array.isArray(data) ? data : []);
          setOpen(true);
          setActive(-1);
        }
      } catch {
        // silent — autocomplete is a progressive enhancement, not required for search to work
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

  function navigate(slug: string) {
    setOpen(false);
    setQuery("");
    router.push(`/${locale}/shop/${slug}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (active >= 0 && suggestions[active]) {
      navigate(suggestions[active].slug);
    } else if (query.trim()) {
      setOpen(false);
      router.push(`/${locale}/shop?search=${encodeURIComponent(query.trim())}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
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
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </form>

      {open && suggestions.length > 0 && (
        <div className={styles.dropdown}>
          {suggestions.map((s, i) => (
            <button key={s.id} type="button" onMouseDown={() => navigate(s.slug)} className={`${styles.suggestion} ${i === active ? styles.suggestionActive : ""}`}>
              {s.title}
            </button>
          ))}
          <a href={`/${locale}/shop?search=${encodeURIComponent(query)}`} className={styles.seeAll}>
            {t.shop.seeAllResultsFor} &ldquo;{query}&rdquo;
          </a>
        </div>
      )}
    </div>
  );
}
