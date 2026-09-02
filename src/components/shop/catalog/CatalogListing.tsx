import Link from "next/link";
import { ChevronDown } from "lucide-react";
import ProductCard, { type ProductListItem } from "@/components/shop/ProductCard";
import type { PromotionInfo } from "@/components/shop/PromotionBadge";
import { getTranslations, type Locale } from "@/lib/i18n";
import PriceFilter from "./PriceFilter";
import styles from "./CatalogListing.module.css";

export const LISTING_REVALIDATE = 120;

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

const PAGE_SIZE = 24;

type T = ReturnType<typeof getTranslations>;

/**
 * Everything /sale and /new have in common, which turned out to be all of it
 * bar five strings and a query parameter.
 *
 * They were never going to be different pages: same grid, same sort links,
 * same price filter, same admin-managed copy above and below, same pagination.
 * Kept as one component because the alternative — a second copy — means every
 * fix lands twice, and the mobile filter disclosure had already been rebuilt
 * once because of exactly that.
 */
export interface CatalogListingConfig {
  /** Path segment after the locale: "sale", "new". */
  path: string;
  /** The boolean query parameter the API filters on: "onSale", "isNew". */
  filterParam: string;
  /** PageContent slug holding this page's admin-managed copy. */
  contentSlug: string;
  tag: (t: T) => string;
  breadcrumb: (t: T) => string;
  empty: (t: T) => string;
}

/** The subset of PRODUCT_SORTS these pages offer. `curated` leads as the
 * default (the catalogue's own featured-then-newest order); the other three
 * are cheapest first, dearest first, best rated. */
const SORTS = ["curated", "price_asc", "price_desc", "rating_desc"] as const;
export type Sort = (typeof SORTS)[number];

function sortLabel(sort: Sort, t: T): string {
  switch (sort) {
    case "curated": return t.shop.sortCurated;
    case "price_asc": return t.shop.sortPriceAsc;
    case "price_desc": return t.shop.sortPriceDesc;
    case "rating_desc": return t.shop.sortRatingDesc;
  }
}

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

/** The admin-editable copy for a listing page, stored as PageContent under its
 * own slug — the same store the policy pages use, one row per locale. */
export interface ListingContent {
  title: string;
  intro: string;
  sections: { title: string; body: string }[];
}

function findMatchingPromotion(promotions: ActivePromotion[], productId: string, categoryIds: string[]): ActivePromotion | null {
  for (const promo of promotions) {
    if (promo.scope === "site_wide") return promo;
    if (promo.scope === "category" && promo.linkedCategoryIds.some((id) => categoryIds.includes(id))) return promo;
    if (promo.scope === "product" && promo.linkedProductIds.includes(productId)) return promo;
  }
  return null;
}

function toPromotionInfo(promotion: ActivePromotion | null): PromotionInfo | null {
  return promotion ? { name: promotion.name, discountType: promotion.discountType, discountValue: promotion.discountValue } : null;
}

/** The filter is resolved server-side rather than by trimming a fetched page
 * here — otherwise the total and the page boundaries would both be wrong. */
async function fetchProducts(
  filterParam: string,
  locale: string,
  sort: Sort,
  page: number,
  minPrice: number | null,
  maxPrice: number | null,
): Promise<{ items: ProductListItem[]; total: number }> {
  const qs = new URLSearchParams({
    [filterParam]: "true",
    sort,
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
    lang: locale,
  });
  if (minPrice !== null) qs.set("minPrice", String(minPrice));
  if (maxPrice !== null) qs.set("maxPrice", String(maxPrice));
  try {
    const res = await fetch(`${API_BASE_URL}/shop/products?${qs}`, { next: { revalidate: LISTING_REVALIDATE } });
    if (!res.ok) return { items: [], total: 0 };
    const data = await res.json();
    return { items: Array.isArray(data.items) ? data.items : [], total: typeof data.total === "number" ? data.total : 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

async function fetchActivePromotions(locale: string): Promise<ActivePromotion[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/promotions/active?lang=${locale}`, { next: { revalidate: LISTING_REVALIDATE } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchContent(slug: string, locale: string): Promise<ListingContent | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/content/${slug}?locale=${locale}`, { next: { revalidate: LISTING_REVALIDATE } });
    if (!res.ok) return null;
    const record = (await res.json()) as { data?: Partial<ListingContent> } | null;
    const data = record?.data;
    if (!data) return null;
    return {
      title: typeof data.title === "string" ? data.title : "",
      intro: typeof data.intro === "string" ? data.intro : "",
      sections: Array.isArray(data.sections) ? data.sections : [],
    };
  } catch {
    return null;
  }
}

/** Query prices travel in cents, matching the API and the search page. */
function parseCents(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface ListingSearchParams {
  sort?: string;
  page?: string;
  minPrice?: string;
  maxPrice?: string;
}

export default async function CatalogListing({
  locale,
  searchParams,
  config,
}: {
  locale: Locale;
  searchParams: ListingSearchParams;
  config: CatalogListingConfig;
}) {
  const { sort: rawSort, page: rawPage, minPrice: rawMin, maxPrice: rawMax } = searchParams;
  const t = getTranslations(locale);

  const sort: Sort = SORTS.includes(rawSort as Sort) ? (rawSort as Sort) : "curated";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const minPrice = parseCents(rawMin);
  const maxPrice = parseCents(rawMax);

  const [{ items: products, total }, promotions, content] = await Promise.all([
    fetchProducts(config.filterParam, locale, sort, page, minPrice, maxPrice),
    fetchActivePromotions(locale),
    fetchContent(config.contentSlug, locale),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Deliberately no fallback: the admin owns this copy, and an unfilled field
  // renders nothing rather than a built-in stand-in that reads like a real
  // editorial decision nobody made.
  const title = content?.title?.trim() ?? "";
  const intro = content?.intro?.trim() ?? "";
  // Long-form copy lives below the grid, the way a category page carries its
  // SEO text — the intro above stays short, with an anchor down to the rest.
  const sections = (content?.sections ?? []).filter((s) => s.title?.trim() || s.body?.trim());

  /** Shown in the disclosure header on mobile, where the panel is closed by
   * default and this badge is the only clue that a filter is still applied. */
  const activeFilters = (sort !== "curated" ? 1 : 0) + (minPrice !== null || maxPrice !== null ? 1 : 0);

  /** Sort and price changes reset to page 1; page links keep both. */
  const href = (next: { sort?: Sort; page?: number }) => {
    const qs = new URLSearchParams();
    const s = next.sort ?? sort;
    const p = next.page ?? 1;
    if (s !== "curated") qs.set("sort", s);
    if (minPrice !== null) qs.set("minPrice", String(minPrice));
    if (maxPrice !== null) qs.set("maxPrice", String(maxPrice));
    if (p > 1) qs.set("page", String(p));
    const q = qs.toString();
    return `/${locale}/${config.path}${q ? `?${q}` : ""}`;
  };

  return (
    <div className={styles.container}>
      <nav className={styles.breadcrumbs} aria-label={config.breadcrumb(t)}>
        <Link href={`/${locale}`}>{t.shop.homeBreadcrumb}</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>{config.breadcrumb(t)}</span>
      </nav>

      {/* The whole header goes when the admin has written neither field — a
          lone "Sale" pill over nothing is worse than starting at the grid. */}
      {(title || intro) && (
        <header className={styles.header}>
          <span className={styles.headerTag}>{config.tag(t)}</span>
          {title && <h1 className={styles.title}>{title}</h1>}
          {intro && (
            <p className={styles.intro}>
              {intro}
              {sections.length > 0 && (
                <>
                  {" "}
                  <a href="#listing-more" className={styles.readMore}>
                    {t.shop.saleReadMore}
                  </a>
                </>
              )}
            </p>
          )}
        </header>
      )}

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label={t.shop.filtersTitle}>
          {/* A native <details> rather than a client disclosure: collapsed is the
              correct initial state on mobile with or without JS, and the desktop
              column is forced open in CSS, so one tree serves both. */}
          <details className={styles.filters}>
            <summary className={styles.filtersSummary}>
              <span className={styles.filtersHeading}>{t.shop.filtersTitle}</span>
              {/* aria-hidden: a bare "2" read after the label explains nothing, and the
                  panel it opens states the applied filters in full. */}
              {activeFilters > 0 && (
                <span className={styles.filtersCount} aria-hidden="true">
                  {activeFilters}
                </span>
              )}
              <ChevronDown size={16} className={styles.filtersChevron} aria-hidden="true" />
            </summary>

            <div className={styles.filtersBody}>
              <div className={styles.filterBlock}>
                <h3 className={styles.filterGroupTitle}>{t.shop.sortLabel}</h3>
                {/* Links, not radios: keeps the aside server-rendered and leaves
                    every sort crawlable and shareable. */}
                <ul className={styles.sortList}>
                  {SORTS.map((s) => (
                    <li key={s}>
                      <Link href={href({ sort: s })} className={s === sort ? styles.sortLinkActive : styles.sortLink} aria-current={s === sort}>
                        <span className={styles.sortMark} aria-hidden="true" />
                        {sortLabel(s, t)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.filterBlock}>
                <h3 className={styles.filterGroupTitle}>{t.shop.filtersPrice}</h3>
                {/* Keyed on the applied range so a navigation reseeds the inputs —
                    see the note in PriceFilter about why it is not an effect. */}
                <PriceFilter key={`${minPrice ?? ""}-${maxPrice ?? ""}`} minPriceCents={minPrice} maxPriceCents={maxPrice} />
              </div>
            </div>
          </details>
        </aside>

        <main className={styles.main}>
          <div className={styles.toolbar}>
            <p className={styles.resultCount}>
              {total} {total === 1 ? t.shop.resultSingular : t.shop.resultPlural}
            </p>
          </div>

          {products.length === 0 ? (
            <div className={styles.empty}>{config.empty(t)}</div>
          ) : (
            <div className={styles.productGrid}>
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  promotion={toPromotionInfo(findMatchingPromotion(promotions, p.id, (p.categories ?? []).map((c) => c.id)))}
                  locale={locale}
                  t={t}
                />
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <nav className={styles.pagination} aria-label={t.shop.pageLabel}>
              {page > 1 ? (
                <Link href={href({ page: page - 1 })} className={styles.pageNav} rel="prev">
                  {t.shop.prevPage}
                </Link>
              ) : (
                <span className={styles.pageNavDisabled}>{t.shop.prevPage}</span>
              )}

              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={href({ page: p })} className={p === page ? styles.pageLinkActive : styles.pageLink} aria-current={p === page ? "page" : undefined}>
                  {p}
                </Link>
              ))}

              {page < pageCount ? (
                <Link href={href({ page: page + 1 })} className={styles.pageNav} rel="next">
                  {t.shop.nextPage}
                </Link>
              ) : (
                <span className={styles.pageNavDisabled}>{t.shop.nextPage}</span>
              )}
            </nav>
          )}
        </main>
      </div>

      {sections.length > 0 && (
        <section id="listing-more" className={styles.body}>
          {sections.map((s, i) => (
            <div key={i} className={styles.bodySection}>
              {s.title?.trim() && <h2 className={styles.bodyTitle}>{s.title}</h2>}
              {s.body?.trim() && <div className={styles.bodyHtml} dangerouslySetInnerHTML={{ __html: s.body }} />}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
