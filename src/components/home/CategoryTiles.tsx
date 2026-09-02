import Link from "next/link";
import type { getTranslations } from "@/lib/i18n";
import SectionHead from "./SectionHead";
import HomeCarousel from "./HomeCarousel";
import styles from "./Home.module.css";

export interface HomeCategory {
  id: string;
  name: string;
  parentId: string | null;
  imageUrl: string | null;
}

/**
 * Top-level categories as picture tiles — the primary discovery path for a
 * visitor who arrived without a product in mind. Links into the shop listing's
 * category filter rather than a separate route, so there is one canonical
 * browse surface.
 */
export default function CategoryTiles({
  categories,
  locale,
  t,
  title,
  href,
  tinted = false,
}: {
  categories: HomeCategory[];
  locale: string;
  t: ReturnType<typeof getTranslations>;
  /** Admin overrides; absent means this section's own built-in wording and
   *  destination. */
  title?: string;
  href?: string;
  tinted?: boolean;
}) {
  if (categories.length === 0) return null;

  return (
    <section className={`${styles.section} ${tinted ? styles.sectionTinted : ""}`}>
      <div className={styles.container}>
        <SectionHead title={title || t.shop.homeCategoriesTitle} href={href} linkLabel={t.shop.homeViewAll} />
        <HomeCarousel variant="categories" label={title || t.shop.homeCategoriesTitle} prevLabel={t.shop.carouselPrev} nextLabel={t.shop.carouselNext}>
          {categories.map((category) => (
            <Link key={category.id} href={`/${locale}/shop?categoryId=${category.id}`} className={styles.categoryTile}>
              {category.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={category.imageUrl} alt="" className={styles.categoryImage} loading="lazy" />
              ) : (
                <span className={styles.categoryImageFallback} aria-hidden="true" />
              )}
              <span className={styles.categoryScrim}>
                <span className={styles.categoryName}>{category.name}</span>
              </span>
            </Link>
          ))}
        </HomeCarousel>
      </div>
    </section>
  );
}
