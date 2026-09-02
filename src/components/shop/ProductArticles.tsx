import { getTranslations, type Locale } from "@/lib/i18n";
import ProductArticlesCarousel, { type ProductArticle } from "./ProductArticlesCarousel";

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

/** Two full swipes at the widest layout. Past that this stops being a
 *  footnote to the product and starts competing with it. */
const LIMIT = 6;

/**
 * Articles an admin has attached to this product, rendered at the foot of its
 * page.
 *
 * The link is the same BlogProductReference a post already uses to pick the
 * products it mentions — read backwards. Nothing new is authored: tie a post to
 * a product in the blog editor and it appears here.
 */
async function fetchArticles(productId: string, locale: Locale): Promise<ProductArticle[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/blog/posts?productId=${productId}&limit=${LIMIT}&lang=${locale}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: ProductArticle[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

export default async function ProductArticles({
  productId,
  locale,
  title,
}: {
  productId: string;
  locale: Locale;
  /** The admin's own heading for this product, already translated by the API
   *  for the requested language. Blank falls back to the built-in string —
   *  this is a section label, not editorial copy, and a heading-shaped hole
   *  above the cards would read as a bug. */
  title?: string | null;
}) {
  const t = getTranslations(locale);
  const articles = await fetchArticles(productId, locale);

  // No heading over an empty carousel: a product with nothing written about it
  // should end at the section above, not advertise the gap.
  if (articles.length === 0) return null;

  return <ProductArticlesCarousel items={articles} locale={locale} title={title?.trim() || t.shop.productArticlesTitle} />;
}
