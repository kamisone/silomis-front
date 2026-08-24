"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductCard, { type ProductListItem } from "@/components/shop/ProductCard";
import { trackSearch } from "@/lib/shop/behaviorTracking";
import { pixelTrack, trackServerEvent } from "@/lib/metaPixel";
import { ttqTrack, trackTikTokServerEvent } from "@/lib/tiktokPixel";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./Search.module.css";

interface Hit {
  id: string;
  slug: string;
  title: string;
  brand?: string | null;
  minPriceCents?: number | null;
  featuredImageUrl?: string | null;
}

interface SearchResponse {
  hits: Hit[];
  total: number;
  facets: { brand?: Record<string, number> };
  processingTimeMs: number;
}

const PAGE_SIZE = 24;

function toProductListItem(hit: Hit): ProductListItem {
  return {
    id: hit.id,
    slug: hit.slug,
    title: hit.title,
    brand: hit.brand ?? null,
    basePriceCents: hit.minPriceCents ?? null,
    featuredImageUrl: hit.featuredImageUrl ?? null,
    variants: [{ id: hit.id, priceCents: hit.minPriceCents ?? 0, compareAtPriceCents: null, isDefault: true }],
  };
}

export default function SearchResults() {
  const locale = useLocale();
  const t = getTranslations(locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const brand = searchParams.get("brand") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const page = Number(searchParams.get("page") ?? "1");

  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ q, page: String(page), limit: String(PAGE_SIZE) });
      if (brand) qs.set("brand", brand);
      if (minPrice) qs.set("minPrice", minPrice);
      if (maxPrice) qs.set("maxPrice", maxPrice);
      const res = await fetch(`/next-api/public/shop/search?${qs}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [q, brand, minPrice, maxPrice, page]);

  useEffect(() => {
    const timer = setTimeout(fetchResults, 0);
    return () => clearTimeout(timer);
  }, [fetchResults]);

  // Meta Pixel: fires once per distinct non-empty query (not on every filter
  // refetch of the same query). Value/currency/ids only — never customer PII.
  // Same eventId shared between the browser pixel and the server-side
  // Conversions API call for dedup.
  const searchFiredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!q.trim() || searchFiredForRef.current === q) return;
    searchFiredForRef.current = q;
    const eventId = crypto.randomUUID();
    pixelTrack("Search", { search_string: q }, eventId);
    trackServerEvent("Search", eventId, { search_string: q });
  }, [q]);

  // TikTok's Data Sources health check flags Search events missing
  // "content_id", so this waits for results to load (top 10 hits) instead of
  // firing alongside the query, unlike the Meta effect above.
  const tiktokSearchFiredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!q.trim() || !data || tiktokSearchFiredForRef.current === q) return;
    tiktokSearchFiredForRef.current = q;
    const tiktokEventId = crypto.randomUUID();
    const properties = {
      search_string: q,
      contents: data.hits.slice(0, 10).map((h) => ({ content_id: h.id, content_type: "product", content_name: h.title })),
    };
    ttqTrack("Search", properties, tiktokEventId);
    trackTikTokServerEvent("Search", tiktokEventId, properties);
  }, [q, data]);

  // Internal behavior tracking (admin analytics, independent of Meta): needs
  // the actual result count, so it waits for the fetch to land.
  const searchBehaviorFiredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!q.trim() || loading || !data || searchBehaviorFiredForRef.current === q) return;
    searchBehaviorFiredForRef.current = q;
    trackSearch(q, data.total);
  }, [q, loading, data]);

  function pushQuery(updates: Record<string, string>) {
    const p = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v) p.set(k, v);
      else p.delete(k);
    });
    p.set("page", "1");
    router.push(`/${locale}/shop/search?${p.toString()}`);
  }

  const brands = Object.entries(data?.facets?.brand ?? {}).sort((a, b) => b[1] - a[1]);
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className={styles.container}>
      {(brand || minPrice || maxPrice) && (
        <div className={styles.filterBar}>
          {brand && (
            <button onClick={() => pushQuery({ brand: "" })} className={styles.filterChip}>
              {t.shop.filterBrandLabel} {brand} <X size={14} strokeWidth={2} className={styles.filterChipX} />
            </button>
          )}
          {(minPrice || maxPrice) && (
            <button onClick={() => pushQuery({ minPrice: "", maxPrice: "" })} className={styles.filterChip}>
              {t.shop.filterPriceLabel} {minPrice ? `€${parseInt(minPrice, 10) / 100}` : ""}
              {minPrice && maxPrice ? " – " : ""}
              {maxPrice ? `€${parseInt(maxPrice, 10) / 100}` : ""}
              <X size={14} strokeWidth={2} className={styles.filterChipX} />
            </button>
          )}
        </div>
      )}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          {brands.length > 0 && (
            <div className={styles.filterBlock}>
              <h5 className={styles.filterGroupTitle}>{t.shop.filtersBrand}</h5>
              {brands.map(([name, count]) => (
                <button key={name} onClick={() => pushQuery({ brand: brand === name ? "" : name })} className={`${styles.brandBtn} ${brand === name ? styles.brandBtnActive : ""}`}>
                  {name} <span className={styles.brandCount}>({count})</span>
                </button>
              ))}
            </div>
          )}

          <div className={styles.filterBlock}>
            <h5 className={styles.filterGroupTitle}>{t.shop.filtersPrice}</h5>
            <div className={styles.priceRow}>
              <input
                type="number"
                placeholder={t.shop.filtersPriceMin}
                value={minPrice ? String(parseInt(minPrice, 10) / 100) : ""}
                onChange={(e) => pushQuery({ minPrice: e.target.value ? String(parseInt(e.target.value, 10) * 100) : "" })}
                className={styles.priceInput}
              />
              <span className={styles.priceDash}>–</span>
              <input
                type="number"
                placeholder={t.shop.filtersPriceMax}
                value={maxPrice ? String(parseInt(maxPrice, 10) / 100) : ""}
                onChange={(e) => pushQuery({ maxPrice: e.target.value ? String(parseInt(e.target.value, 10) * 100) : "" })}
                className={styles.priceInput}
              />
            </div>
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.resultsMeta}>
            <p className={styles.resultCount}>
              {loading ? t.shop.searching : data ? `${data.total} ${data.total !== 1 ? t.shop.resultPluralCount : t.shop.resultSingularCount}${q ? ` — ${t.shop.searchResultsFor} "${q}"` : ""}` : ""}
            </p>
            {data && data.processingTimeMs > 0 && <span className={styles.processingTime}>{data.processingTimeMs}ms</span>}
          </div>

          {!loading && data?.hits.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{t.shop.noResults}</p>
              <p className={styles.emptyHint}>{t.shop.noResultsTry}</p>
            </div>
          )}

          <div className={styles.productGrid}>
            {(data?.hits ?? []).map((hit) => (
              <ProductCard key={hit.id} product={toProductListItem(hit)} promotion={null} locale={locale} t={t} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={`/${locale}/shop/search?${(() => { const sp = new URLSearchParams(searchParams.toString()); sp.set("page", String(p)); return sp.toString(); })()}`} className={p === page ? styles.pageLinkActive : styles.pageLink}>
                  {p}
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
