import Link from "next/link";
import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import ProductCard, { type ProductListItem } from "@/components/shop/ProductCard";
import type { PromotionInfo } from "@/components/shop/PromotionBadge";
import { isValidLocale, DEFAULT_LOCALE, getTranslations, type Locale } from "@/lib/i18n";
import PriceFilter from "./PriceFilter";
import styles from "./Sale.module.css";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 120;

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

const PAGE_SIZE = 24;

/** The subset of PRODUCT_SORTS this page offers. `curated` leads as the
 * default (highest-priority promotion first, by way of the catalogue's own
 * featured-then-newest order); the other three are the ones the brief asked
 * for — cheapest first, dearest first, best rated. */
const SORTS = ["curated", "price_asc", "price_desc", "rating_desc"] as const;
type Sort = (typeof SORTS)[number];

function sortLabel(sort: Sort, t: ReturnType<typeof getTranslations>): string {
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

/** The admin-editable copy for this page, stored as PageContent under the
 * `sale` slug — same store the policy pages use, one row per locale. */
interface SaleContent {
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

/** `onSale=true` is resolved server-side (ProductsService.onSalePromotionWhere)
 * rather than by filtering a fetched page here — otherwise the total and the
 * page boundaries would both be wrong. */
async function fetchProducts(
  locale: string,
  sort: Sort,
  page: number,
  minPrice: number | null,
  maxPrice: number | null,
): Promise<{ items: ProductListItem[]; total: number }> {
  const qs = new URLSearchParams({
    onSale: "true",
    sort,
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
    lang: locale,
  });
  if (minPrice !== null) qs.set("minPrice", String(minPrice));
  if (maxPrice !== null) qs.set("maxPrice", String(maxPrice));
  try {
    const res = await fetch(`${API_BASE_URL}/shop/products?${qs}`, { next: { revalidate } });
    if (!res.ok) return { items: [], total: 0 };
    const data = await res.json();
    return { items: Array.isArray(data.items) ? data.items : [], total: typeof data.total === "number" ? data.total : 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

async function fetchActivePromotions(locale: string): Promise<ActivePromotion[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/promotions/active?lang=${locale}`, { next: { revalidate } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchContent(locale: string): Promise<SaleContent | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/content/sale?locale=${locale}`, { next: { revalidate } });
    if (!res.ok) return null;
    const record = (await res.json()) as { data?: Partial<SaleContent> } | null;
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

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string; page?: string; minPrice?: string; maxPrice?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const content = await fetchContent(locale);
  const title = content?.title?.trim();
  const description = content?.intro?.trim();
  // No built-in copy stands in for either: what the admin left blank stays
  // blank. An omitted title falls through to the root layout's site-wide
  // default, which is the one <title> a page cannot go without.
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    alternates: localeAlternates(locale, "/sale"),
  };
}

export default async function SalePage({ params, searchParams }: PageProps) {
  const { locale: rawLocale } = await params;
  const { sort: rawSort, page: rawPage, minPrice: rawMin, maxPrice: rawMax } = await searchParams;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = getTranslations(locale);

  const sort: Sort = SORTS.includes(rawSort as Sort) ? (rawSort as Sort) : "curated";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const minPrice = parseCents(rawMin);
  const maxPrice = parseCents(rawMax);

  const [{ items: products, total }, promotions, content] = await Promise.all([
    fetchProducts(locale, sort, page, minPrice, maxPrice),
    fetchActivePromotions(locale),
    fetchContent(locale),
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
    return `/${locale}/sale${q ? `?${q}` : ""}`;
  };

  return (
    <div className={styles.container}>
      <nav className={styles.breadcrumbs} aria-label={t.shop.saleBreadcrumb}>
        <Link href={`/${locale}`}>{t.shop.homeBreadcrumb}</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>{t.shop.saleBreadcrumb}</span>
      </nav>

      {/* The whole header goes when the admin has written neither field — a
          lone "Sale" pill over nothing is worse than starting at the grid. */}
      {(title || intro) && (
        <header className={styles.header}>
          <span className={styles.headerTag}>{t.shop.sale}</span>
          {title && <h1 className={styles.title}>{title}</h1>}
          {intro && (
            <p className={styles.intro}>
              {intro}
              {sections.length > 0 && (
                <>
                  {" "}
                  <a href="#sale-more" className={styles.readMore}>
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
            <div className={styles.empty}>{t.shop.saleEmpty}</div>
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
        <section id="sale-more" className={styles.body}>
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
