import Link from "next/link";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./RelatedSection.module.css";

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

interface RelatedProduct {
  id: string;
  slug: string;
  title: string;
  minPriceCents: number | null;
  featuredImageUrl: string | null;
  freeShipping: boolean;
}

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

function centsToAmount(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

function ProductGrid({ products, locale, freeShippingLabel }: { products: RelatedProduct[]; locale: Locale; freeShippingLabel: string }) {
  return (
    <div className={styles.grid}>
      {products.map((p) => (
        <Link key={p.id} href={`/${locale}/shop/${p.slug}`} className={styles.card}>
          <div className={styles.imageWrap}>
            {p.featuredImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.featuredImageUrl} alt={p.title} className={styles.image} loading="lazy" />
            ) : (
              <div className={styles.imagePlaceholder} />
            )}
            {p.freeShipping && <span className={styles.freeShipBadge}>{freeShippingLabel}</span>}
          </div>
          <div className={styles.info}>
            <h3 className={styles.cardTitle}>{p.title}</h3>
            {p.minPriceCents != null && <span className={styles.price}>{centsToAmount(p.minPriceCents)}</span>}
          </div>
        </Link>
      ))}
    </div>
  );
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
      {frequentlyBoughtTogether.length > 0 && (
        <section className={styles.section} aria-label={t.shop.customersAlsoBought}>
          <h2 className={styles.title}>{t.shop.customersAlsoBought}</h2>
          <ProductGrid products={frequentlyBoughtTogether} locale={locale} freeShippingLabel={t.shop.freeShippingBadge} />
        </section>
      )}

      {similar.length > 0 && (
        <section className={styles.section} aria-label={t.shop.relatedProductsSubtitle}>
          <h2 className={styles.title}>{t.shop.relatedProductsSubtitle}</h2>
          <ProductGrid products={similar} locale={locale} freeShippingLabel={t.shop.freeShippingBadge} />
        </section>
      )}
    </>
  );
}
