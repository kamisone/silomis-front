import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductCard, { type ProductListItem } from "@/components/shop/ProductCard";
import type { PromotionInfo } from "@/components/shop/PromotionBadge";
import { isValidLocale, DEFAULT_LOCALE, getTranslations } from "@/lib/i18n";
import styles from "./Collection.module.css";

export const revalidate = 120;

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

interface CollectionProductLink {
  product: { id: string };
}

interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  metaKeywords: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroCopy: string | null;
  bodyHtml: string | null;
  productLinks: CollectionProductLink[];
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

async function fetchProducts(ids: string[], locale: string): Promise<ProductListItem[]> {
  if (ids.length === 0) return [];
  try {
    const res = await fetch(`${API_BASE_URL}/shop/products?ids=${ids.join(",")}&limit=${ids.length}&lang=${locale}`, { next: { revalidate } });
    if (!res.ok) return [];
    const data = await res.json();
    const items: ProductListItem[] = Array.isArray(data.items) ? data.items : [];
    const order = new Map(ids.map((id, i) => [id, i]));
    return items.slice().sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  } catch {
    return [];
  }
}

async function fetchActivePromotions(): Promise<ActivePromotion[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/promotions/active`, { next: { revalidate } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const collection = await fetchCollection(slug, locale);
  if (!collection) return { title: "Collection not found — Silomis" };
  return {
    title: collection.seoTitle?.trim() || `${collection.name} — Silomis`,
    description: collection.seoDescription?.trim() || collection.description || undefined,
    keywords: collection.metaKeywords?.trim() || undefined,
  };
}

export default async function CollectionPage({ params }: PageProps) {
  const { slug, locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = getTranslations(locale);

  const collection = await fetchCollection(slug, locale);
  if (!collection) notFound();

  const productIds = collection.productLinks.map((link) => link.product.id);
  const [products, promotions] = await Promise.all([fetchProducts(productIds, locale), fetchActivePromotions()]);

  const heroTitle = collection.heroTitle || collection.name;
  const heroSubtitle = collection.heroSubtitle || collection.description;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        {collection.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={collection.imageUrl} alt="" className={styles.heroImage} />
        )}
        <div className={styles.heroOverlay}>
          <h1 className={styles.heroTitle}>{heroTitle}</h1>
          {heroSubtitle && <p className={styles.heroDesc}>{heroSubtitle}</p>}
        </div>
      </div>

      {collection.heroCopy && <p className={styles.heroCopy}>{collection.heroCopy}</p>}

      {products.length === 0 ? (
        <div className={styles.empty}>{t.shop.collectionEmpty}</div>
      ) : (
        <div className={styles.productGrid}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} promotion={toPromotionInfo(findMatchingPromotion(promotions, p.id, (p.categories ?? []).map((c) => c.id)))} locale={locale} t={t} />
          ))}
        </div>
      )}

      {collection.bodyHtml && <div className={styles.bodyHtml} dangerouslySetInnerHTML={{ __html: collection.bodyHtml }} />}
    </div>
  );
}
