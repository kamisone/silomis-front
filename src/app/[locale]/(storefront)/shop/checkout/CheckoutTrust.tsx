"use client";

import { useId } from "react";
import { Lock, MessageCircle, Spool, Star } from "lucide-react";
import PaymentIcons from "@/components/shop/PaymentIcons";
import { toBcp47, type Locale, getTranslations } from "@/lib/i18n";
import { formatDay } from "@/lib/shop/deliveryDates";
import { openSupportChat } from "@/lib/support/openSupportChat";
import styles from "./CheckoutTrust.module.css";

export interface ReviewSummary {
  average: number;
  count: number;
}

interface Props {
  locale: Locale;
  /** The basket's products' rating; nothing is shown without at least one review. */
  reviews: ReviewSummary | null;
  /** The basket holds embroidery the customer added. */
  embroidered: boolean;
  /** When an embroidered order leaves; null when there is no production time to wait for. */
  shipsBy: Date | null;
  /** "summary" sits inside the order summary card; "card" stands alone (under the form on a phone). */
  variant: "summary" | "card";
}

/**
 * What a customer about to pay a shop they do not know yet wants settled, in
 * one place beside the total: what other buyers thought, that the payment is
 * safe, where and when an embroidered order is made, and a person to ask.
 *
 * Shown on every step. On a desktop it closes the sticky order summary; on a
 * phone, where the summary sits above the form, it comes after the step —
 * the spot a hesitating customer scrolls down to.
 */
export default function CheckoutTrust({ locale, reviews, embroidered, shipsBy, variant }: Props) {
  const t = getTranslations(locale).shop;
  const titleId = useId();
  const hasReviews = !!reviews && reviews.count > 0 && reviews.average > 0;
  const rating = hasReviews ? reviews.average.toLocaleString(toBcp47(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "";
  const countLabel = hasReviews ? (reviews.count === 1 ? t.reviewsCountOne : t.reviewsCountMany).replace("{count}", reviews.count.toLocaleString(toBcp47(locale))) : "";

  return (
    <section className={`${styles.root} ${variant === "card" ? styles.card : styles.inSummary}`} aria-labelledby={titleId}>
      <h4 id={titleId} className={styles.title}>
        {t.trustTitle}
      </h4>

      {hasReviews && (
        <p className={styles.rating}>
          <Star size={15} className={styles.star} fill="currentColor" strokeWidth={0} aria-hidden="true" />
          <span className={styles.ratingValue} aria-hidden="true">
            {rating}
          </span>
          <span className={styles.ratingCount} aria-hidden="true">
            · {countLabel}
          </span>
          <span className={styles.srOnly}>
            {t.ratingOutOf.replace("{rating}", rating)}, {countLabel}
          </span>
        </p>
      )}

      <ul className={styles.list}>
        <li className={styles.item}>
          <span className={styles.icon} aria-hidden="true">
            <Lock size={15} strokeWidth={2} />
          </span>
          <span className={styles.body}>
            <span className={styles.itemTitle}>{t.trustSecureTitle}</span>
            <PaymentIcons label={t.acceptedPayments} className={styles.payments} />
          </span>
        </li>

        {embroidered && (
          <li className={styles.item}>
            <span className={styles.icon} aria-hidden="true">
              <Spool size={15} strokeWidth={2} />
            </span>
            <span className={styles.body}>
              <span className={styles.itemTitle}>{t.trustEmbroideredTitle}</span>
              {shipsBy && <span className={styles.itemText}>{t.trustShipsBy.replace("{date}", formatDay(shipsBy, locale))}</span>}
            </span>
          </li>
        )}

        <li className={styles.item}>
          <span className={styles.icon} aria-hidden="true">
            <MessageCircle size={15} strokeWidth={2} />
          </span>
          <span className={styles.body}>
            <span className={styles.itemTitle}>{t.trustQuestionTitle}</span>
            <button type="button" className={styles.chatBtn} onClick={openSupportChat}>
              {t.trustChat}
            </button>
          </span>
        </li>
      </ul>
    </section>
  );
}

