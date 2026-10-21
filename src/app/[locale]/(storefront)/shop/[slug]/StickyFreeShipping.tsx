"use client";

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { getTranslations, type Locale } from "@/lib/i18n";
import { fetchProductDeliveryOptions } from "@/lib/shop/productDeliveryOptions";
import styles from "./ProductDetail.module.css";

interface Props {
  locale: Locale;
  productId: string;
  priceCents: number;
  /** The product's own free-shipping estimate, used until (or unless) the quote has one. */
  daysMin: number | null | undefined;
  daysMax: number | null | undefined;
}

/**
 * The free-shipping pill of the sticky buy bar, with "3–5 business days"
 * under it. The days are the free option's, from the same (shared, cached)
 * quote the banner under the price uses, so the two always agree.
 */
export default function StickyFreeShipping({ locale, productId, priceCents, daysMin, daysMax }: Props) {
  const t = getTranslations(locale).shop;
  const [quoted, setQuoted] = useState<{ min: number; max: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProductDeliveryOptions(productId, priceCents, locale)
      .then((data) => {
        const free = data.methods.find((m) => m.isFree);
        if (!cancelled) setQuoted(free ? { min: free.estimatedDaysMin, max: free.estimatedDaysMax } : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productId, priceCents, locale]);

  const max = quoted?.max ?? daysMax ?? null;
  const min = quoted?.min ?? daysMin ?? max;
  const days = max != null && max > 0 ? `${min != null && min !== max ? `${min}–${max}` : max} ${t.deliveryDetailsDaysUnit}` : null;

  return (
    <span className={styles.stickyFreeShipping}>
      <span className={styles.stickyFreeShippingPill}>
        <Truck size={13} strokeWidth={2.4} aria-hidden="true" />
        {t.freeShippingBadge}
      </span>
      {days && <span className={styles.stickyFreeShippingDays}>{days}</span>}
    </span>
  );
}
