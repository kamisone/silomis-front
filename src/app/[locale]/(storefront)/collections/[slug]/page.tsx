import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductCard, { type ProductListItem } from "@/components/shop/ProductCard";
import type { PromotionInfo } from "@/components/shop/PromotionBadge";
import { isValidLocale, DEFAULT_LOCALE, getTranslations, type Locale } from "@/lib/i18n";
import styles from "./Collection.module.css";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 120;

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

const PAGE_SIZE = 24;

/** Mirrors PRODUCT_SORTS in the backend's product.dto.ts. `curated` is the
 * admin's own drag-to-reorder order on the collection, so it leads. */
const SORTS = ["curated", "newest", "price_asc", "price_desc", "name_asc"] as const;
type Sort = (typeof SORTS)[number];

function sortLabel(sort: Sort, t: ReturnType<typeof getTranslations>): string {
  switch (sort) {
    case "curated": return t.shop.sortCurated;
    case "newest": return t.shop.sortNewest;
    case "price_asc": return t.shop.sortPriceAsc;
    case "price_desc": return t.shop.sortPriceDesc;
    case "name_asc": return t.shop.sortNameAsc;
  }
}

interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  bannerImageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  metaKeywords: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroCopy: string | null;
  bodyHtml: string | null;
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

async function fetchCollection(slug: string, locale: string): Promise<Collection | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/collections/${slug}?lang=${locale}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as Collection;
  } catch {
    return null;
  }
}

/** Products come from the catalogue endpoint filtered by collection slug —
 * not from the collection's own embedded productLinks — so sorting and
 * paging happen in the database rather than over a fully-materialised list. */
async function fetchProducts(slug: string, locale: string, sort: Sort, page: number): Promise<{ items: ProductListItem[]; total: number }> {
  const qs = new URLSearchParams({
    collection: slug,
    sort,
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
    lang: locale,
  });
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

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const collection = await fetchCollection(slug, locale);
  if (!collection) return { title: "Collection not found", robots: { index: false, follow: true } };
  return {
    title: collection.seoTitle?.trim() || collection.name,
    description: collection.seoDescription?.trim() || collection.description || undefined,
    keywords: collection.metaKeywords?.trim() || undefined,
    alternates: localeAlternates(locale as Locale, `/collections/${collection.slug}`),
  };
}

export default async function CollectionPage({ params, searchParams }: PageProps) {
  const { slug, locale: rawLocale } = await params;
  const { sort: rawSort, page: rawPage } = await searchParams;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = getTranslations(locale);

  const sort: Sort = SORTS.includes(rawSort as Sort) ? (rawSort as Sort) : "curated";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  const collection = await fetchCollection(slug, locale);
  if (!collection) notFound();

  const [{ items: products, total }, promotions] = await Promise.all([fetchProducts(slug, locale, sort, page), fetchActivePromotions(locale)]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Banner is the purpose-made wide hero; the card image is the fallback so a
  // collection without a banner still gets a picture rather than a blank block.
  const heroImageUrl = collection.bannerImageUrl || collection.imageUrl;
  const heroTitle = collection.heroTitle || collection.name;
  const heroSubtitle = collection.heroSubtitle || collection.description;

  /** Sort links reset to page 1; page links keep the current sort. */
  const href = (next: { sort?: Sort; page?: number }) => {
    const qs = new URLSearchParams();
    const s = next.sort ?? sort;
    const p = next.page ?? 1;
    if (s !== "curated") qs.set("sort", s);
    if (p > 1) qs.set("page", String(p));
    const q = qs.toString();
    return `/${locale}/collections/${collection.slug}${q ? `?${q}` : ""}`;
  };

  return (
    <>
      <div className={styles.breadcrumbBar}>
        <nav className={styles.breadcrumbs} aria-label={t.shop.collectionsTitle}>
          <Link href={`/${locale}/collections`}>{t.shop.collectionsTitle}</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{collection.name}</span>
        </nav>
      </div>

      {/* Full-bleed, outside the reading-width container, like the home hero. */}
      <div className={styles.hero}>
        {heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImageUrl} alt="" className={styles.heroImage} />
        )}
        <div className={styles.heroFade} aria-hidden="true" />
        <div className={styles.heroOverlay}>
          <h1 className={styles.heroTitle}>{heroTitle}</h1>
          {heroSubtitle && <p className={styles.heroDesc}>{heroSubtitle}</p>}
        </div>
      </div>

      <div className={styles.container}>
      {collection.heroCopy && <p className={styles.heroCopy}>{collection.heroCopy}</p>}

      {total > 0 && (
        <div className={styles.toolbar}>
          <p className={styles.resultCount}>
            {total} {total === 1 ? t.shop.resultSingular : t.shop.resultPlural}
          </p>
          {/* Links, not a <select>: keeps the page a server component and
              leaves every sort crawlable and shareable. */}
          <div className={styles.sortRow} role="group" aria-label={t.shop.sortLabel}>
            <span className={styles.sortLabel}>{t.shop.sortLabel}</span>
            {SORTS.map((s) => (
              <Link key={s} href={href({ sort: s })} className={s === sort ? styles.sortPillActive : styles.sortPill} aria-current={s === sort}>
                {sortLabel(s, t)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className={styles.empty}>{t.shop.collectionEmpty}</div>
      ) : (
        <div className={styles.productGrid}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} promotion={toPromotionInfo(findMatchingPromotion(promotions, p.id, (p.categories ?? []).map((c) => c.id)))} locale={locale} t={t} />
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

      {collection.bodyHtml && <div className={styles.bodyHtml} dangerouslySetInnerHTML={{ __html: collection.bodyHtml }} />}
      </div>
    </>
  );
}
