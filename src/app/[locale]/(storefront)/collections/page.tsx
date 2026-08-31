import Link from "next/link";
import type { Metadata } from "next";
import { isValidLocale, DEFAULT_LOCALE, getTranslations, type Locale } from "@/lib/i18n";
import styles from "./Collections.module.css";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 300;

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

interface CollectionCard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  productCount: number;
}

async function fetchCollections(locale: string): Promise<CollectionCard[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/collections?lang=${locale}`, { next: { revalidate } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = getTranslations(locale);
  return {
    title: t.shop.collectionsTitle,
    description: t.shop.collectionsSubtitle,
    alternates: localeAlternates(locale, "/collections"),
  };
}

export default async function CollectionsIndexPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = getTranslations(locale);

  const collections = await fetchCollections(locale);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.shop.collectionsTitle}</h1>
        <p className={styles.subtitle}>{t.shop.collectionsSubtitle}</p>
      </header>

      {collections.length === 0 ? (
        <div className={styles.empty}>{t.shop.collectionsEmpty}</div>
      ) : (
        <div className={styles.grid}>
          {collections.map((c) => (
            <Link key={c.id} href={`/${locale}/collections/${c.slug}`} className={styles.card}>
              <div className={styles.imageWrap}>
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className={styles.image} loading="lazy" />
                ) : (
                  <div className={styles.imagePlaceholder} />
                )}
                {c.isFeatured && <span className={styles.featuredBadge}>★</span>}
              </div>
              <div className={styles.info}>
                <h2 className={styles.cardTitle}>{c.name}</h2>
                {c.description && <p className={styles.cardDesc}>{c.description}</p>}
                <span className={styles.count}>
                  {c.productCount} {c.productCount === 1 ? t.shop.resultSingular : t.shop.resultPlural}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
