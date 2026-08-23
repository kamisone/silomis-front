import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./PriceBreakdown.module.css";

function fmt(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

export interface PriceBreakdownProps {
  locale: Locale;
  subtotalCents: number;
  shippingCents?: number;
  freeShipping?: boolean;
  discountCents?: number;
  couponCode?: string | null;
  totalCents: number;
  loading?: boolean;
}

export default function PriceBreakdown({ locale, subtotalCents, shippingCents, freeShipping, discountCents, couponCode, totalCents, loading = false }: PriceBreakdownProps) {
  const t = getTranslations(locale);
  const shippingKnown = shippingCents !== undefined;
  /**
   * Once a shipping method has been applied, what was actually charged decides —
   * never the eligibility flag. An order that qualified for free shipping but
   * bought the paid faster option is not free, and must not be labelled as such
   * while its total includes the fee. The flag only previews "Free" earlier, in
   * the cart, where no method has been chosen and the cost is not yet known.
   */
  const shippingFree = shippingKnown ? shippingCents === 0 : !!freeShipping;

  if (loading) {
    return (
      <div className={styles.root}>
        {[60, 90, 80].map((w, i) => (
          <div key={i} className={styles.row}>
            <span className={styles.skeleton} style={{ width: w }} />
            <span className={styles.skeleton} style={{ width: 50 }} />
          </div>
        ))}
        <div className={styles.total}>
          <span className={styles.skeleton} style={{ width: 50 }} />
          <span className={styles.skeleton} style={{ width: 70 }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.row}>
        <span className={styles.label}>{t.shop.subtotal}</span>
        <span className={styles.value}>{fmt(subtotalCents)}</span>
      </div>

      <div className={`${styles.row} ${shippingFree ? styles.rowDiscount : styles.rowShipping}`}>
        <span className={styles.label}>{t.shop.shipping}</span>
        <span className={styles.value}>
          {/* A known-free order says so in the cart already, before an address
              is entered and the exact shipping cost is resolvable. */}
          {shippingFree ? t.shop.free : !shippingKnown ? <em style={{ fontWeight: 400, color: "var(--price-text-muted)", fontStyle: "normal" }}>{t.shop.shippingCalcAtCheckout}</em> : fmt(shippingCents!)}
        </span>
      </div>

      {!!discountCents && discountCents > 0 && (
        <div className={`${styles.row} ${styles.rowDiscount}`}>
          <span className={styles.label}>
            {t.shop.discount}
            {couponCode && <span className={styles.sub}>{t.shop.discountCodeSuffix.replace("{code}", couponCode)}</span>}
          </span>
          <span className={styles.value}>−{fmt(discountCents)}</span>
        </div>
      )}

      <div className={styles.total}>
        <span className={styles.totalLabel}>{t.shop.total}</span>
        <span className={styles.totalValue}>{fmt(totalCents)}</span>
      </div>
    </div>
  );
}
