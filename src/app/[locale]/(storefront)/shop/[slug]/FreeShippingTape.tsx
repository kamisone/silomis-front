"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Truck, Clock } from "lucide-react";
import { getTranslations, type Locale } from "@/lib/i18n";
import { fetchProductDeliveryOptions } from "@/lib/shop/productDeliveryOptions";
import { countryName, flagEmoji } from "./FreeShippingBanner";
import styles from "./FreeShippingTape.module.css";

interface Props {
  locale: Locale;
  productId: string;
  priceCents: number;
  /** The product's own free-shipping estimate, until (or unless) the quote has one. */
  daysMin: number | null | undefined;
  daysMax: number | null | undefined;
}

/**
 * The "Free delivery to 🇫🇷 France · Delivered in 3–5 business days" tape
 * right under the neutral header, on a neutral product with free shipping.
 *
 * Country and days come from the same shared, cached quote as the banner
 * under the price (checkout country, else IP), so the two never disagree.
 * Until it answers — or when the visitor's country is unknown — the tape
 * says plain "Free shipping": it is there from the first paint either way,
 * so the page does not jump.
 */
export default function FreeShippingTape({ locale, productId, priceCents, daysMin, daysMax }: Props) {
  const t = getTranslations(locale).shop;
  const [country, setCountry] = useState<string | null>(null);
  const [quoted, setQuoted] = useState<{ min: number; max: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProductDeliveryOptions(productId, priceCents, locale)
      .then((data) => {
        if (cancelled) return;
        setCountry(data.country);
        const free = data.methods.find((m) => m.isFree);
        setQuoted(free ? { min: free.estimatedDaysMin, max: free.estimatedDaysMax } : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productId, priceCents, locale]);

  const max = quoted?.max ?? daysMax ?? null;
  const min = quoted?.min ?? daysMin ?? max;
  const days = max != null && max > 0 ? `${min != null && min !== max ? `${min}–${max}` : max} ${t.deliveryDetailsDaysUnit}` : null;

  const title: ReactNode = country
    ? t.freeShippingTo.split(/(\{country\})/).map((part, i) =>
        part === "{country}" ? (
          <span key={i} className={styles.country}>
            <span className={styles.flag} aria-hidden="true">
              {flagEmoji(country)}
            </span>
            {countryName(country, locale)}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )
    : t.freeShippingBadge;

  return (
    <div className={styles.tape} role="note">
      <div className={styles.inner}>
        <span className={styles.truck} aria-hidden="true">
          <Truck size={17} strokeWidth={2.3} />
        </span>
        <strong className={styles.title}>{title}</strong>
        {days && (
          <>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.days}>
              <Clock size={14} strokeWidth={2.3} aria-hidden="true" />
              {t.freeTapeDays.replace("{days}", days)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
