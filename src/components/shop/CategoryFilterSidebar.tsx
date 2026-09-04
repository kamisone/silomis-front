"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PriceRangeSlider from "./PriceRangeSlider";
import Switch from "@/components/admin/ui/Switch";
import { FilterDrawerProvider, FilterDrawerTrigger, FilterDrawerPanel } from "./FilterDrawer";
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
    <aside className={`${styles.sidebar} ${styles.skeletonSidebar}`} aria-hidden="true">
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

interface CategoryFiltersState {
  data: FiltersResponse | null;
  selectedValueIds: Set<string>;
  minPriceParam: string | null;
  maxPriceParam: string | null;
  toggleValue: (valueId: string) => void;
  pushQuery: (updates: Record<string, string | null>) => void;
}

const CategoryFiltersContext = createContext<CategoryFiltersState | null>(null);

function useCategoryFilters(): CategoryFiltersState {
  const ctx = useContext(CategoryFiltersContext);
  if (!ctx) throw new Error("CategoryFilterTrigger/Panel must be rendered inside a CategoryFiltersProvider");
  return ctx;
}

/**
 * Fetches this leaf category's filters once and shares them — plus the
 * URL-driven selection state — between `CategoryFilterTrigger` and
 * `CategoryFilterPanel`, which `ShopListing` renders at two different DOM
 * positions: the trigger at the bottom of the category banner, the panel
 * further down as the desktop sidebar column. Entirely URL-driven —
 * `minPrice`/`maxPrice` (cents, same convention `/shop/search` already uses)
 * and `filters` (comma-separated CategoryFilterValue ids) — so every state is
 * a real, shareable, back-button-safe link, and ShopListing reads the very
 * same params to build its product query.
 */
export function CategoryFiltersProvider({ categoryId, children }: { categoryId: string; children: ReactNode }) {
  const locale = useLocale();
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

  return (
    <CategoryFiltersContext.Provider value={{ data, selectedValueIds, minPriceParam, maxPriceParam, toggleValue, pushQuery }}>
      <FilterDrawerProvider>{children}</FilterDrawerProvider>
    </CategoryFiltersContext.Provider>
  );
}

/** The mobile-only "Filters" button — pinned at the bottom of the category
 *  banner (`ShopListing` places it right after `CategoryHero`), rather than
 *  floating as its own bar above the grid. Renders nothing until the
 *  category's filters are known and at least one actually applies — no
 *  button to open a drawer with nothing in it. */
export function CategoryFilterTrigger() {
  const t = getTranslations(useLocale());
  const { data, selectedValueIds, minPriceParam, maxPriceParam } = useCategoryFilters();
  if (!data) return null;
  const hasPrice = !!data.priceBounds;
  if (data.filters.length === 0 && !hasPrice) return null;
  const activeFilterCount = selectedValueIds.size + (minPriceParam || maxPriceParam ? 1 : 0);
  return <FilterDrawerTrigger title={t.shop.filtersButtonLabel} activeCount={activeFilterCount} className={styles.heroFilterTrigger} />;
}

/**
 * The actual filter content: a price range plus one multi-select checkbox
 * group per filter the admin defined on this leaf category. On desktop this
 * is the sticky sidebar column; below the drawer breakpoint it's the panel
 * `CategoryFilterTrigger` opens.
 */
export function CategoryFilterPanel({ resultCount }: { resultCount: number }) {
  const locale = useLocale();
  const t = getTranslations(locale);
  const { data, selectedValueIds, minPriceParam, maxPriceParam, toggleValue, pushQuery } = useCategoryFilters();

  if (!data) return <SidebarSkeleton />;
  const bounds = data.priceBounds;
  // Enabling the filter is enough to show the group — a category whose
  // products all currently share one price (a thin catalogue, or genuinely
  // uniform pricing) still gets the "Price" block, just as a plain figure
  // instead of a slider with nothing to drag between.
  const hasPrice = !!bounds;
  const isPriceRange = hasPrice && bounds!.minCents < bounds!.maxCents;
  if (data.filters.length === 0 && !hasPrice) return null;

  return (
    <FilterDrawerPanel
      title={t.shop.filtersButtonLabel}
      closeLabel={t.shop.filtersCloseLabel}
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
    </FilterDrawerPanel>
  );
}
