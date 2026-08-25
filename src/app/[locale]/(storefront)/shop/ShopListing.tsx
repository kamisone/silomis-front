"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buildCategoryTree, getAncestorIds, type CategoryNode as BaseCategoryNode } from "@/lib/shop/categoryTree";
import ProductCard, { type ProductListItem } from "@/components/shop/ProductCard";
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
}

type CategoryNode = BaseCategoryNode<Category>;

function CategoryTreeItem({ node, activeCategory, buildUrl }: { node: CategoryNode; activeCategory?: string; buildUrl: (params: Record<string, string | undefined>) => string }) {
  const isActive = activeCategory === node.id;
  return (
    <li>
      <Link href={buildUrl({ categoryId: node.id })} className={`${styles.categoryLink} ${isActive ? styles.activeCategory : ""}`}>
        {node.name}
      </Link>
      {node.children.length > 0 && (
        <ul className={styles.categorySublist}>
          {node.children.map((child) => (
            <CategoryTreeItem key={child.id} node={child} activeCategory={activeCategory} buildUrl={buildUrl} />
          ))}
        </ul>
      )}
    </li>
  );
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

  useEffect(() => {
    fetch("/next-api/public/shop/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    fetch(`/next-api/public/shop/promotions/active?lang=${locale}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPromotions(Array.isArray(data) ? data : []))
      .catch(() => setPromotions([]));
  }, [locale]);

  useEffect(() => {
    let cancelled = false;

    function load() {
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
  }, [categoryId, search, featured]);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

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
        <aside className={styles.sidebar}>
          <h4 className={styles.sidebarTitle}>{t.shop.categoriesLabel}</h4>
          <ul className={styles.categoryList}>
            <li>
              <Link href={buildUrl({ categoryId: undefined })} className={`${styles.categoryLink} ${!categoryId ? styles.activeCategory : ""}`}>
                {t.shop.allProducts}
              </Link>
            </li>
            {categoryTree.map((node) => (
              <CategoryTreeItem key={node.id} node={node} activeCategory={categoryId} buildUrl={buildUrl} />
            ))}
          </ul>
        </aside>

        <div className={styles.main}>
          {categoryPath.length > 0 && (
            <nav className={styles.breadcrumbs} aria-label={t.shop.categoriesLabel}>
              <Link href={buildUrl({ categoryId: undefined })} className={styles.breadcrumbLink}>
                {t.shop.allProducts}
              </Link>
              {categoryPath.map((cat, i) => (
                <span key={cat.id} className={styles.breadcrumbSegment}>
                  <span className={styles.breadcrumbSep}>/</span>
                  {i === categoryPath.length - 1 ? <span className={styles.breadcrumbCurrent}>{cat.name}</span> : <Link href={buildUrl({ categoryId: cat.id })}>{cat.name}</Link>}
                </span>
              ))}
            </nav>
          )}

          {search && (
            <p className={styles.searchNotice}>
              {t.shop.searchResultsFor} &ldquo;{search}&rdquo;
            </p>
          )}

          {!loading && (
            <p className={styles.resultCount}>
              {total} {total === 1 ? t.shop.resultSingular : t.shop.resultPlural}
            </p>
          )}

          {loading ? (
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
