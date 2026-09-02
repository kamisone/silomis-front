"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./CatalogListing.module.css";

/** Euros in the boxes, cents on the wire — the API and the search page both
 * speak cents, and the shopper should never have to. */
function centsToEuroField(cents: number | null): string {
  return cents === null ? "" : String(Math.round(cents / 100));
}

function euroFieldToCents(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return String(Math.round(n * 100));
}

/**
 * The one interactive part of the sale aside. Sort stays plain links in the
 * server component next door; a price range needs two text fields and a
 * commit, so it is the only thing that ships JS.
 */
export default function PriceFilter({ minPriceCents, maxPriceCents }: { minPriceCents: number | null; maxPriceCents: number | null }) {
  const locale = useLocale();
  const t = getTranslations(locale);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Seeded from the URL, then owned by the shopper while they type. The page
  // keys this component on the applied range, so a navigation — Apply, Clear,
  // or the browser's back button — remounts it with the new values instead of
  // syncing them back in an effect.
  const [min, setMin] = useState(() => centsToEuroField(minPriceCents));
  const [max, setMax] = useState(() => centsToEuroField(maxPriceCents));

  const active = minPriceCents !== null || maxPriceCents !== null;

  function apply(next: { min: string | null; max: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of [["minPrice", next.min], ["maxPrice", next.max]] as const) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // A narrower range almost never has as many pages as the old one.
    params.delete("page");
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <form
      className={styles.priceForm}
      onSubmit={(e) => {
        e.preventDefault();
        apply({ min: euroFieldToCents(min), max: euroFieldToCents(max) });
      }}
    >
      <div className={styles.priceRow}>
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className={styles.priceInput}
          placeholder={t.shop.filtersPriceMin}
          aria-label={t.shop.filtersPriceMin}
          value={min}
          onChange={(e) => setMin(e.target.value)}
        />
        <span className={styles.priceDash} aria-hidden="true">
          –
        </span>
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className={styles.priceInput}
          placeholder={t.shop.filtersPriceMax}
          aria-label={t.shop.filtersPriceMax}
          value={max}
          onChange={(e) => setMax(e.target.value)}
        />
      </div>
      <div className={styles.priceActions}>
        <button type="submit" className={styles.priceApply}>
          {t.shop.filtersApply}
        </button>
        {active && (
          <button type="button" className={styles.priceClear} onClick={() => apply({ min: null, max: null })}>
            {t.shop.filtersReset}
          </button>
        )}
      </div>
    </form>
  );
}
