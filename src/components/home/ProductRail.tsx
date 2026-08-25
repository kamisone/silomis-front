import ProductCard, { type ProductListItem } from "@/components/shop/ProductCard";
import type { PromotionInfo } from "@/components/shop/PromotionBadge";
import type { Locale, getTranslations } from "@/lib/i18n";
import SectionHead from "./SectionHead";
import styles from "./Home.module.css";

/**
 * One horizontal row of products, reused for every rail on the page (new
 * arrivals, our picks, and whatever comes next).
 *
 * Reuses the listing's ProductCard, so a shopper can add to the cart straight
 * from the home page — the shortest path from landing to a filled cart, and the
 * main reason the home page is worth more than a redirect to /shop.
 */
export default function ProductRail({
  title,
  products,
  href,
  locale,
  t,
  promotionFor,
  tinted = false,
}: {
  title: string;
  products: ProductListItem[];
  href: string;
  locale: Locale;
  t: ReturnType<typeof getTranslations>;
  promotionFor?: (product: ProductListItem) => PromotionInfo | null;
  tinted?: boolean;
}) {
  if (products.length === 0) return null;

  return (
    <section className={`${styles.section} ${tinted ? styles.sectionTinted : ""}`}>
      <div className={styles.container}>
        <SectionHead title={title} href={href} linkLabel={t.shop.homeViewAll} />
        <div className={styles.rail}>
          {products.map((product) => (
            <div key={product.id} className={styles.railItem}>
              <ProductCard product={product} promotion={promotionFor?.(product) ?? null} locale={locale} t={t} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
