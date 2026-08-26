import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { getTranslations } from "@/lib/i18n";
import SectionHead from "./SectionHead";
import styles from "./Home.module.css";

export interface HomeCollection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
}

/**
 * Collections flagged `isFeatured` in admin, in their `sortOrder`. This is the
 * merchandising lever the Collection model was designed for — an admin curates
 * a set and it surfaces here without a deploy.
 */
export default function FeaturedCollections({
  collections,
  locale,
  t,
  title,
  subtitle,
  href,
  tinted = false,
}: {
  collections: HomeCollection[];
  locale: string;
  t: ReturnType<typeof getTranslations>;
  /** Admin overrides; absent means this section's own built-in wording and
   *  destination. */
  title?: string;
  /** Admin's own line under the heading. Unlike `title` this has no built-in
   *  default: nothing typed means no subtitle, so an admin who clears it gets a
   *  bare heading rather than shipped-in marketing copy coming back. */
  subtitle?: string;
  href?: string;
  tinted?: boolean;
}) {
  if (collections.length === 0) return null;

  return (
    <section className={`${styles.section} ${tinted ? styles.sectionTinted : ""}`}>
      <div className={styles.container}>
        <SectionHead
          title={title || t.shop.homeCollectionsTitle}
          subtitle={subtitle}
          href={href || `/${locale}/collections`}
          linkLabel={t.shop.homeViewAll}
        />
        <div className={styles.collectionGrid}>
          {collections.map((collection) => (
            <Link key={collection.id} href={`/${locale}/collections/${collection.slug}`} className={styles.collectionCard}>
              <div className={styles.collectionMedia}>
                {collection.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={collection.imageUrl} alt="" className={styles.collectionImage} loading="lazy" />
                ) : (
                  <div className={styles.collectionImageFallback} aria-hidden="true" />
                )}
              </div>
              <div className={styles.collectionBody}>
                <h3 className={styles.collectionName}>{collection.name}</h3>
                {collection.description && <p className={styles.collectionDesc}>{collection.description}</p>}
                <span className={styles.collectionCue}>
                  {t.shop.homeCta}
                  <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
