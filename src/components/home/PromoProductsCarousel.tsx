import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductCard, { type ProductListItem } from "@/components/shop/ProductCard";
import type { PromotionInfo } from "@/components/shop/PromotionBadge";
import type { Locale, getTranslations } from "@/lib/i18n";
import PromoCarouselTrack from "./PromoCarouselTrack";
import styles from "./PromoProductsCarousel.module.css";

/**
 * The home page's promotion section: the reduced products an admin picked,
 * as a carousel of ordinary product cards.
 *
 * It replaced a band that announced one promotion by name. A shopper cannot
 * buy a promotion — they buy a product — so the band now shows the things on
 * offer, at the price they are on offer for, each with the add-to-cart the
 * rest of the site uses. The offer itself is on every card, as the percentage
 * in its sale badge.
 *
 * Server-rendered; only the scrolling is a client island (PromoCarouselTrack).
 */
export default function PromoProductsCarousel({
  title,
  products,
  href,
  locale,
  t,
  promotionFor,
}: {
  title: string;
  products: ProductListItem[];
  href: string;
  locale: Locale;
  t: ReturnType<typeof getTranslations>;
  promotionFor?: (product: ProductListItem) => PromotionInfo | null;
}) {
  if (products.length === 0) return null;

  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          <Link href={href} className={styles.viewAll}>
            {t.shop.homeViewAll}
            <ArrowRight size={15} strokeWidth={2.25} aria-hidden="true" />
          </Link>
        </div>

        <PromoCarouselTrack label={title} prevLabel={t.shop.carouselPrev} nextLabel={t.shop.carouselNext}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} promotion={promotionFor?.(product) ?? null} locale={locale} t={t} />
          ))}
        </PromoCarouselTrack>
      </div>
    </section>
  );
}
