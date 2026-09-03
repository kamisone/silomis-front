"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PriceRangeSlider from "./PriceRangeSlider";
import Switch from "@/components/admin/ui/Switch";
import FilterDrawer from "./FilterDrawer";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import skeleton from "./skeleton.module.css";
import styles from "./CategoryFilterSidebar.module.css";

interface FilterValue {
  id: string;
  label: string;
  isDefault: boolean;
}
interface FilterDef {
  id: string;
  name: string;
  values: FilterValue[];
}
interface FiltersResponse {
  filters: FilterDef[];
  priceBounds: { minCents: number; maxCents: number } | null;
}

function centsToEuroLabel(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

/** Shown for the one render where this category's own filters haven't
 *  arrived yet — a generic shape (a price-slider-sized bar, two checkbox-list-
 *  sized groups) rather than nothing, so the sidebar's reserved column in the
 *  grid isn't just an empty gap that pops full a beat later. On a narrow
 *  screen `.sidebar` is hidden outright (see the module CSS) — there's
 *  nothing to filter yet, so no trigger button and no drawer either. */
function SidebarSkeleton() {
  return (
    <aside className={styles.sidebar} aria-hidden="true">
      <div className={styles.group}>
        <div className={`${skeleton.bar} ${styles.skeletonGroupTitle}`} />
        <div className={`${skeleton.bar} ${styles.skeletonSlider}`} />
      </div>
      {[0, 1].map((i) => (
        <div className={styles.group} key={i}>
          <div className={`${skeleton.bar} ${styles.skeletonGroupTitle}`} />
          {[0, 1, 2].map((j) => (
            <div key={j} className={`${skeleton.bar} ${styles.skeletonCheckboxRow}`} />
          ))}
        </div>
      ))}
    </aside>
  );
}

/**
 * The category listing's filter sidebar: a price range plus one multi-select
 * checkbox group per filter the admin defined on this leaf category. Entirely
 * URL-driven — `minPrice`/`maxPrice` (cents, same convention `/shop/search`
 * already uses) and `filters` (comma-separated CategoryFilterValue ids) — so
 * every state is a real, shareable, back-button-safe link, and ShopListing
 * reads the very same params to build its product query.
 *
 * The mobile-drawer chrome (trigger, backdrop, slide-in panel, dismissal,
 * scroll lock, footer CTA) lives in the shared `FilterDrawer` — this
 * component only owns the actual filter content and the URL-driven state
 * behind it.
 */
export default function CategoryFilterSidebar({ categoryId, resultCount }: { categoryId: string; resultCount: number }) {
  const locale = useLocale();
  const t = getTranslations(locale);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<FiltersResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/next-api/public/shop/categories/${categoryId}/filters?lang=${locale}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId, locale]);

  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const selectedValueIds = new Set((searchParams.get("filters") ?? "").split(",").filter(Boolean));

  function pushQuery(updates: Record<string, string | null>) {
    const p = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v) p.set(k, v);
      else p.delete(k);
    });
    // Scroll preserved: toggling a checkbox or dragging the slider shouldn't
    // yank the page back to the top of a long product grid.
    router.push(`/${locale}/shop?${p.toString()}`, { scroll: false });
  }

  function toggleValue(valueId: string) {
    const next = new Set(selectedValueIds);
    if (next.has(valueId)) next.delete(valueId);
    else next.add(valueId);
    pushQuery({ filters: next.size ? [...next].join(",") : null });
  }

  if (!data) return <SidebarSkeleton />;
  const bounds = data.priceBounds;
  // Enabling the filter is enough to show the group — a category whose
  // products all currently share one price (a thin catalogue, or genuinely
  // uniform pricing) still gets the "Price" block, just as a plain figure
  // instead of a slider with nothing to drag between.
  const hasPrice = !!bounds;
  const isPriceRange = hasPrice && bounds!.minCents < bounds!.maxCents;
  if (data.filters.length === 0 && !hasPrice) return null;

  const activeFilterCount = selectedValueIds.size + (minPriceParam || maxPriceParam ? 1 : 0);

  return (
    <FilterDrawer
      title={t.shop.filtersButtonLabel}
      closeLabel={t.shop.filtersCloseLabel}
      activeCount={activeFilterCount}
      footerLabel={`${t.shop.filtersShowCta} · ${resultCount} ${resultCount === 1 ? t.shop.resultSingularCount : t.shop.resultPluralCount}`}
      className={styles.sidebar}
    >
      {hasPrice && bounds && (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>{t.shop.filtersPrice}</h3>
          {isPriceRange ? (
            <PriceRangeSlider
              // Remounts whenever the committed URL value changes from outside
              // a drag on this same slider (a bookmark, a filter cleared
              // elsewhere) — see the component's own comment for why that's a
              // `key` and not an internal effect syncing to these props.
              key={`${minPriceParam ?? bounds.minCents}-${maxPriceParam ?? bounds.maxCents}`}
              boundsMinCents={bounds.minCents}
              boundsMaxCents={bounds.maxCents}
              valueMinCents={minPriceParam ? Number(minPriceParam) : bounds.minCents}
              valueMaxCents={maxPriceParam ? Number(maxPriceParam) : bounds.maxCents}
              onCommit={(min, max) =>
                pushQuery({
                  minPrice: min > bounds.minCents ? String(min) : null,
                  maxPrice: max < bounds.maxCents ? String(max) : null,
                })
              }
              minLabel={t.shop.filtersPriceMin}
              maxLabel={t.shop.filtersPriceMax}
              formatValue={centsToEuroLabel}
            />
          ) : (
            // Nothing to narrow — a slider needs two ends. Shown rather than
            // hidden, so turning the filter on always shows *something* here.
            <p className={styles.singlePrice}>{centsToEuroLabel(bounds.minCents)}</p>
          )}
        </div>
      )}

      {data.filters.map((f) => (
        <div className={styles.group} key={f.id}>
          <h3 className={styles.groupTitle}>{f.name}</h3>
          <div className={styles.checkboxList} role="group" aria-label={f.name}>
            {f.values.map((v) => (
              <Switch key={v.id} label={v.label} checked={selectedValueIds.has(v.id)} onChange={() => toggleValue(v.id)} />
            ))}
          </div>
        </div>
      ))}
    </FilterDrawer>
  );
}
