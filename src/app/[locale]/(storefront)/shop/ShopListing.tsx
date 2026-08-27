"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getAncestorIds } from "@/lib/shop/categoryTree";
import ProductCard, { type ProductListItem } from "@/components/shop/ProductCard";
import CategoryHero from "@/components/shop/CategoryHero";
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

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<ActivePromotion[]>([]);
  const [loading, setLoading] = useState(true);
  /* Whether this category has children decides what the page shows, so the
     product request waits for the tree rather than firing a query whose result
     may turn out not to belong on the page at all. */
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  useEffect(() => {
    fetch("/next-api/public/shop/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setCategories(Array.isArray(data) ? data : []);
        setCategoriesLoaded(true);
      })
      .catch(() => {
        setCategories([]);
        setCategoriesLoaded(true);
      });
  }, []);

  useEffect(() => {
    fetch(`/next-api/public/shop/promotions/active?lang=${locale}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPromotions(Array.isArray(data) ? data : []))
      .catch(() => setPromotions([]));
  }, [locale]);

  /**
   * This category's immediate children, in the admin's order.
   *
   * A branch category shows its children; only a leaf shows products. Browsing
   * "Apparel" and being handed every shirt, coat and pair of trousers at once
   * skips the step the tree exists for.
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
      // Nothing to ask for: a branch category renders its children, and a
      // request whose answer cannot be shown is a request worth not making.
      if (!categoriesLoaded || showsSubcategories) {
        setProducts([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      const qs = new URLSearchParams();
      if (categoryId) qs.set("categoryId", categoryId);
      if (search) qs.set("search", search);
      if (featured) qs.set("featured", featured);
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
          if (!cancelled) setLoading(false);
        });
    }

    const timer = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryId, search, featured, categoriesLoaded, showsSubcategories]);

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

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        <div className={styles.main}>
          {categoryPath.length > 0 && (
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

          {search && (
            <p className={styles.searchNotice}>
              {t.shop.searchResultsFor} &ldquo;{search}&rdquo;
            </p>
          )}

          {/* A count of products belongs only where products are shown; over a
              grid of categories it would be counting the wrong thing. */}
          {!loading && !showsSubcategories && (
            <p className={styles.resultCount}>
              {total} {total === 1 ? t.shop.resultSingular : t.shop.resultPlural}
            </p>
          )}

          {showsSubcategories ? (
            <div className={styles.categoryGrid}>
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
            </div>
          ) : loading ? (
            <div className={styles.empty}>{t.shop.loading}</div>
          ) : products.length === 0 ? (
            <div className={styles.empty}>{t.shop.noProductsFound}</div>
          ) : (
            <div className={styles.productGrid}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} promotion={toPromotionInfo(findMatchingPromotion(promotions, p.id, (p.categories ?? []).map((c) => c.id)))} locale={locale} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
