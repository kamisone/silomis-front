import { getTranslations, type Locale } from "@/lib/i18n";
import RelatedProductsCarousel, { type RelatedProduct } from "./RelatedProductsCarousel";

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

interface Recommendations {
  frequentlyBoughtTogether: RelatedProduct[];
  similar: RelatedProduct[];
}

async function fetchRecommendations(slug: string): Promise<Recommendations> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/products/${slug}/recommendations`, { next: { revalidate: 3600 } });
    if (!res.ok || res.status === 204) return { frequentlyBoughtTogether: [], similar: [] };
    return (await res.json()) as Recommendations;
  } catch {
    return { frequentlyBoughtTogether: [], similar: [] };
  }
}

interface Props {
  slug: string;
  locale: Locale;
}

export default async function RelatedSection({ slug, locale }: Props) {
  const t = getTranslations(locale);
  const { frequentlyBoughtTogether, similar } = await fetchRecommendations(slug);

  if (!frequentlyBoughtTogether.length && !similar.length) return null;

  return (
    <>
      <RelatedProductsCarousel items={frequentlyBoughtTogether} locale={locale} title={t.shop.customersAlsoBought} />
      <RelatedProductsCarousel items={similar} locale={locale} title={t.shop.relatedProductsSubtitle} />
    </>
  );
}
