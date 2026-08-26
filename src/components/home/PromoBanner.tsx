import Link from "next/link";
import type { getTranslations } from "@/lib/i18n";
import styles from "./Home.module.css";

export interface HomePromotion {
  id: string;
  name: string;
  description: string | null;
  discountType: "percentage" | "fixed_amount" | "free_shipping";
  discountValue: number;
}

/** Headline form of the offer — "-20%", "€10 off", "Free delivery". */
function discountLabel(promotion: HomePromotion, freeShippingLabel: string): string {
  switch (promotion.discountType) {
    case "percentage":
      return `-${promotion.discountValue}%`;
    case "fixed_amount":
      return `-${(promotion.discountValue / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" })}`;
    case "free_shipping":
      return freeShippingLabel;
  }
}

/**
 * The single highest-priority active promotion, full-bleed in brand colour.
 *
 * One banner, not a list: a page that shouts about four offers at once sells
 * none of them. The rest still surface as per-product badges in the rails below.
 */
export default function PromoBanner({
  promotion,
  locale,
  t,
}: {
  promotion: HomePromotion | null;
  locale: string;
  t: ReturnType<typeof getTranslations>;
}) {
  if (!promotion) return null;

  return (
    <section className={styles.promo}>
      <div className={`${styles.container} ${styles.promoInner}`}>
        <div className={styles.promoText}>
          <span className={styles.promoBadge}>{discountLabel(promotion, t.shop.freeShippingBadge)}</span>
          <p className={styles.promoTitle}>{promotion.name}</p>
          {promotion.description && <p className={styles.promoDesc}>{promotion.description}</p>}
        </div>
        <Link href={`/${locale}/sale`} className={styles.promoCta}>
          {t.shop.homePromoCta}
        </Link>
      </div>
    </section>
  );
}
