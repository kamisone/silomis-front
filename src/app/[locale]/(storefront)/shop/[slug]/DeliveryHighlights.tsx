import { PackageSearch, Zap } from "lucide-react";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./ProductDetail.module.css";

interface Props {
  locale: Locale;
  fastDelivery?: boolean;
  trackedDelivery?: boolean;
}

/**
 * The product's delivery promises, each switched on per product in the admin:
 * "Fast delivery" and "Order tracking included". Sits right above Delivery
 * details so the promise and the options that back it read together. Nothing
 * at all when both are off.
 */
export default function DeliveryHighlights({ locale, fastDelivery, trackedDelivery }: Props) {
  if (!fastDelivery && !trackedDelivery) return null;
  const t = getTranslations(locale).shop;

  return (
    <ul className={styles.highlights}>
      {fastDelivery && (
        <li className={`${styles.highlight} ${styles.highlightFast}`}>
          <span className={styles.highlightIcon} aria-hidden="true">
            <Zap size={17} strokeWidth={2.4} />
          </span>
          <span className={styles.highlightText}>
            <strong className={styles.highlightTitle}>{t.fastDeliveryTitle}</strong>
            <span className={styles.highlightBody}>{t.fastDeliveryBody}</span>
          </span>
        </li>
      )}
      {trackedDelivery && (
        <li className={`${styles.highlight} ${styles.highlightTracked}`}>
          <span className={styles.highlightIcon} aria-hidden="true">
            <PackageSearch size={17} strokeWidth={2.2} />
          </span>
          <span className={styles.highlightText}>
            <strong className={styles.highlightTitle}>{t.trackedDeliveryTitle}</strong>
            <span className={styles.highlightBody}>{t.trackedDeliveryBody}</span>
          </span>
        </li>
      )}
    </ul>
  );
}
