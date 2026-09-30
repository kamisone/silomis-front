"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getAncestorIds } from "@/lib/shop/categoryTree";
import ProductCard, { type ProductListItem } from "@/components/shop/ProductCard";
import CategoryHero from "@/components/shop/CategoryHero";
import CategoryHeroSkeleton from "@/components/shop/CategoryHeroSkeleton";
import { CategoryFiltersProvider, CategoryFilterTrigger, CategoryFilterPanel } from "@/components/shop/CategoryFilterSidebar";
import ProductGridSkeleton from "@/components/shop/ProductGridSkeleton";
import ScrollRail from "@/components/shop/ScrollRail";
import type { PromotionInfo } from "@/components/shop/PromotionBadge";
import { trackSearch } from "@/lib/shop/behaviorTracking";
import { pixelTrack, trackServerEvent } from "@/lib/metaPixel";
import { ttqTrack, trackTikTokServerEvent } from "@/lib/tiktokPixel";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./Shop.module.css";

interface ActivePromotion {
  id: string;
  name: string;
  description: string | null;
  discountType: "percentage" | "fixed_amount" | "free_shipping";
  discountValue: number;
  scope: "site_wide" | "category" | "product";
  linkedCategoryIds: string[];
  linkedProductIds: string[];
}

/** `/shop/promotions/active` is already ordered by priority DESC server-side,
 * so the first scope match in list order is the highest-priority one. */
function findMatchingPromotion(promotions: ActivePromotion[], productId: string, categoryIds: string[]): ActivePromotion | null {
  for (const promo of promotions) {
    if (promo.scope === "site_wide") return promo;
    if (promo.scope === "category" && promo.linkedCategoryIds.some((id) => categoryIds.includes(id))) return promo;
    if (promo.scope === "product" && promo.linkedProductIds.includes(productId)) return promo;
  }
  return null;
}

interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  description?: string | null;
  sortOrder?: number;
  /** The card picture, used when this category is shown as a tile inside its
   *  parent's listing. Distinct from `bannerUrl`, which is the wide band across
   *  the top of the category's own page. */
  imageUrl?: string | null;
  /** Wide picture across the top of this category's listing. Resolved by the
   *  API — `bannerKey` alone is a storage key the browser cannot render. */
  bannerUrl?: string | null;
}

function toPromotionInfo(promotion: ActivePromotion | null): PromotionInfo | null {
  return promotion ? { name: promotion.name, discountType: promotion.discountType, discountValue: promotion.discountValue } : null;
}

export default function ShopListing() {
  const locale = useLocale();
  const t = getTranslations(locale);
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const featured = searchParams.get("featured") ?? undefined;
  // The category filter sidebar's own state — read here too so a change to
  // any of them re-fetches the product list they narrow.
  const minPrice = searchParams.get("minPrice") ?? undefined;
  const maxPrice = searchParams.get("maxPrice") ?? undefined;
  const filterValues = searchParams.get("filters") ?? undefined;

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<ActivePromotion[]>([]);
  const [loading, setLoading] = useState(true);
  /* True once the first products fetch has settled (either way) — the signal
     for "is there anything on screen to keep showing while we refetch", as
     opposed to `loading`, which is just "is a request in flight right now". */
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  /* Whether this category has children decides what the page shows, so the
     product request waits for the tree rather than firing a query whose result
     may turn out not to belong on the page at all. */
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  useEffect(() => {
    // `lang` overlays the admin's translated category names — without it this
    // list came back in the base language regardless of locale.
    fetch(`/next-api/public/shop/categories?lang=${locale}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setCategories(Array.isArray(data) ? data : []);
        setCategoriesLoaded(true);
      })
      .catch(() => {
        setCategories([]);
        setCategoriesLoaded(true);
      });
  }, [locale]);

  useEffect(() => {
    fetch(`/next-api/public/shop/promotions/active?lang=${locale}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPromotions(Array.isArray(data) ? data : []))
      .catch(() => setPromotions([]));
  }, [locale]);

  /**
   * This category's immediate children, in the admin's order.
   *
   * A branch shows these AND, under them, everything filed anywhere beneath it.
   * Tiles alone were a dead end: a shopper who does not yet know whether they
   * want a snapback or a trucker had no way to see the caps, and a branch whose
   * children were not yet photographed showed a row of grey panels and nothing
   * else. The tiles narrow; the grid below is the answer to "just show me".
   */
  const subcategories = useMemo(() => {
    if (!categoryId) return [] as Category[];
    return categories
      .filter((c) => c.parentId === categoryId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }, [categories, categoryId]);

  const showsSubcategories = subcategories.length > 0;

  useEffect(() => {
    let cancelled = false;

    function load() {
      // Still waiting on the tree — which decides whether tiles go above the
      // grid, not whether there is a grid at all.
      if (!categoriesLoaded) {
        setProducts([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      const qs = new URLSearchParams();
      // Without this the cards came back in the base language on every locale
      // — the category and promotion fetches above already send it, and this
      // one is what supplies the titles the shopper actually reads.
      qs.set("lang", locale);
      if (categoryId) qs.set("categoryId", categoryId);
      if (search) qs.set("search", search);
      if (featured) qs.set("featured", featured);
      if (minPrice) qs.set("minPrice", minPrice);
      if (maxPrice) qs.set("maxPrice", maxPrice);
      if (filterValues) qs.set("filters", filterValues);
      qs.set("limit", "60");

      fetch(`/next-api/public/shop/products?${qs.toString()}`)
        .then((r) => (r.ok ? r.json() : { items: [], total: 0 }))
        .then((data) => {
          if (cancelled) return;
          const items = Array.isArray(data.items) ? data.items : [];
          setProducts(items);
          setTotal(typeof data.total === "number" ? data.total : 0);
          if (search) {
            trackSearch(search, items.length);

            // Meta Pixel / TikTok: value/currency/ids only — never add
            // customer PII here. Same eventId shared between the browser
            // pixel and the server-side Conversions/Events API call for dedup.
            const eventId = crypto.randomUUID();
            const customData = { search_string: search, content_ids: items.map((i: { id: string }) => i.id) };
            pixelTrack("Search", customData, eventId);
            trackServerEvent("Search", eventId, customData);

            const tiktokEventId = crypto.randomUUID();
            const tiktokProperties = { query: search, contents: items.map((i: { id: string }) => ({ content_id: i.id, content_type: "product" })) };
            ttqTrack("Search", tiktokProperties, tiktokEventId);
            trackTikTokServerEvent("Search", tiktokEventId, tiktokProperties);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setProducts([]);
            setTotal(0);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
            setHasLoadedOnce(true);
          }
        });
    }

    const timer = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locale, categoryId, search, featured, minPrice, maxPrice, filterValues, categoriesLoaded]);

  const activeCategory = categoryId ? categories.find((c) => c.id === categoryId) ?? null : null;
  /** The branch this category sits in — context the name alone cannot give. */
  const parentCategory = activeCategory?.parentId ? categories.find((c) => c.id === activeCategory.parentId) ?? null : null;

  const categoryPath = useMemo(() => {
    if (!categoryId) return [] as Category[];
    const byId = new Map(categories.map((c) => [c.id, c]));
    const ancestors = getAncestorIds(categories, categoryId)
      .slice()
      .reverse()
      .map((id) => byId.get(id))
      .filter((c): c is Category => !!c);
    const current = byId.get(categoryId);
    return current ? [...ancestors, current] : ancestors;
  }, [categories, categoryId]);

  function buildUrl(params: Record<string, string | undefined>) {
    const qs = new URLSearchParams();
    const merged: Record<string, string | undefined> = { categoryId, search, ...params };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) qs.set(k, v);
    });
    return `/${locale}/shop${qs.toString() ? `?${qs.toString()}` : ""}`;
  }

  // The sidebar narrows the grid, and a branch has one now — so it belongs on
  // both. It draws nothing of its own accord when the category has no filters
  // and no price bounds, which is the usual case for a branch, so this costs an
  // empty panel nowhere.
  const showsFilters = !!categoryId;

  // Nothing meaningful to show yet — either the category tree itself hasn't
  // loaded (so it's unknown whether this is even a product-bearing leaf), or
  // it has and the very first products request is still in flight. Once
  // `hasLoadedOnce` flips true, a further refetch (a filter, a price drag)
  // keeps the existing grid on screen instead of falling back to this.
  const initialLoading = !categoriesLoaded || (loading && !hasLoadedOnce);

  // Written once and reused in both branches below: the shape is identical
  // whether or not this category has filters, only the trigger button (which
  // renders nothing on its own when `showsFilters` is false — see
  // `CategoryFilterTrigger`) and the `CategoryFiltersProvider` wrapper differ.
  // The category name that would head this page is only known once the tree
  // has loaded — show its shape rather than nothing, so the banner doesn't
  // pop in a beat after the rest of the page. Rendered full-bleed, outside
  // the reading-width container below, like the home hero.
  const masthead = !categoriesLoaded && categoryId ? (
    <CategoryHeroSkeleton />
  ) : (
    <>
      {categoryPath.length > 0 && (
        <div className={styles.breadcrumbBar}>
          <nav className={styles.breadcrumbs} aria-label={t.shop.categoriesLabel}>
            <Link href={`/${locale}`}>
              {t.shop.homeBreadcrumb}
            </Link>
            {categoryPath.map((cat, i) => (
              <span key={cat.id} className={styles.breadcrumbSegment}>
                <span className={styles.breadcrumbSep}>/</span>
                {i === categoryPath.length - 1 ? <span className={styles.breadcrumbCurrent}>{cat.name}</span> : <Link href={buildUrl({ categoryId: cat.id })}>{cat.name}</Link>}
              </span>
            ))}
          </nav>
        </div>
      )}

      {/* The category's masthead: the banner is the visual, its name and
          description sit inside it at the lower left. See CategoryHero for
          why the overlay adapts to how bright the artwork is. */}
      {activeCategory && (
        <CategoryHero
          name={activeCategory.name}
          description={activeCategory.description}
          bannerUrl={activeCategory.bannerUrl}
          parentName={parentCategory?.name}
        />
      )}
    </>
  );

  const mainContent = (
    <div className={styles.main}>
      {/* Mobile-only "Filters" trigger, pinned to the bottom of the banner
          above rather than floating as its own bar further down the page —
          renders nothing until `showsFilters` is true and there's actually
          something in this category to filter by. */}
      {showsFilters && <CategoryFilterTrigger />}

      {search && (
        <p className={styles.searchNotice}>
          {t.shop.searchResultsFor} &ldquo;{search}&rdquo;
        </p>
      )}

      {/* Only over the grid, and only once there is a grid: on a branch the
          count sits with the products below rather than up here, where it would
          read as a count of the subcategories beside it. Stays on screen (with a
          spinner alongside) through a refetch instead of disappearing and
          reappearing — only the first-ever load has nothing worth showing. */}
      {!showsSubcategories && hasLoadedOnce && (
        <div className={styles.resultCountRow}>
          <p className={styles.resultCount}>
            {total} {total === 1 ? t.shop.resultSingular : t.shop.resultPlural}
          </p>
          {loading && <span className={styles.spinner} role="status" aria-live="polite" aria-label={t.shop.loading} />}
        </div>
      )}

      {/* A branch: the ways to narrow first, then everything under it. */}
      {showsSubcategories && (
        <>
          <ScrollRail
            className={styles.categoryRail}
            wrapClassName={styles.categoryRailWrap}
            prevLabel={t.shop.railPrev}
            nextLabel={t.shop.railNext}
          >
            {subcategories.map((cat) => (
              <Link key={cat.id} href={buildUrl({ categoryId: cat.id })} className={styles.categoryCard}>
                <span className={styles.categoryMedia}>
                  {cat.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cat.imageUrl} alt="" className={styles.categoryImage} loading="lazy" />
                  ) : (
                    // A tinted panel rather than a hole in the grid, so an
                    // unfinished catalogue still looks deliberate.
                    <span className={styles.categoryImageFallback} aria-hidden="true" />
                  )}
                </span>
                <span className={styles.categoryBody}>
                  <span className={styles.categoryName}>{cat.name}</span>
                  {cat.description && <span className={styles.categoryDesc}>{cat.description}</span>}
                  <span className={styles.categoryCue}>
                    {t.shop.browseCategory}
                    <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
                  </span>
                </span>
              </Link>
            ))}
          </ScrollRail>

          {/* The join between the two halves of the page. It names what follows
              — "Everything in Caps", not a bare "Products" — because after a row
              of tiles the question a shopper is answering is "and if I don't
              want to choose?". Hidden entirely while the branch has nothing in
              it: a heading over an empty state says the shop is broken, where no
              heading at all just means the tiles are the whole page. */}
          {(initialLoading || products.length > 0) && (
            <div className={styles.allInRow}>
              <h2 className={styles.allInTitle}>
                {t.shop.allInCategory.replace("{category}", activeCategory?.name ?? "")}
              </h2>
              {hasLoadedOnce && (
                <span className={styles.allInCount}>
                  {total} {total === 1 ? t.shop.resultSingular : t.shop.resultPlural}
                </span>
              )}
              {loading && <span className={styles.spinner} role="status" aria-live="polite" aria-label={t.shop.loading} />}
            </div>
          )}
        </>
      )}

      {initialLoading ? (
        <ProductGridSkeleton />
      ) : products.length === 0 && !loading ? (
        // On a branch the tiles above are already a way forward, so an empty
        // grid needs no apology — and saying "no products found" under them
        // would contradict them.
        showsSubcategories ? null : <div className={styles.empty}>{t.shop.noProductsFound}</div>
      ) : (
        // `loading` here only ever means "refetching with something to
        // show already" — dimmed in place rather than swapped out, per
        // `initialLoading` above having already claimed the empty case.
        <div className={`${styles.productGrid} ${loading ? styles.productGridLoading : ""}`}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} promotion={toPromotionInfo(findMatchingPromotion(promotions, p.id, (p.categories ?? []).map((c) => c.id)))} locale={locale} t={t} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {masthead}
      <div className={styles.container}>
        <div className={`${styles.layout} ${showsFilters ? styles.layoutFiltered : ""}`}>
          {showsFilters && categoryId ? (
            <CategoryFiltersProvider categoryId={categoryId}>
              <CategoryFilterPanel resultCount={total} />
              {mainContent}
            </CategoryFiltersProvider>
          ) : (
            mainContent
          )}
        </div>
      </div>
    </>
  );
}
