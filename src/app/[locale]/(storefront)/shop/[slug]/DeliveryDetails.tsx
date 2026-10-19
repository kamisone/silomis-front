"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Truck } from "lucide-react";
import { getTranslations, toBcp47, type Locale } from "@/lib/i18n";
import { carrierLogo } from "@/lib/shop/carrierLogo";
import { deliveryWindow, formatArrival } from "@/lib/shop/deliveryDates";
import { fetchProductDeliveryOptions, type ProductDeliveryOptions as DeliveryOptions, type QuotedMethod } from "@/lib/shop/productDeliveryOptions";
import styles from "./ProductDetail.module.css";

function centsToEuros(cents: number) {
  return (cents / 100).toFixed(2);
}

/** "Spain" in the shop language, from the browser's own CLDR data — as the header strip does. */
function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([toBcp47(locale)], { type: "region", fallback: "code" }).of(code) ?? code;
  } catch {
    return code;
  }
}

interface Props {
  locale: Locale;
  productId: string;
  /** The selected variant's price: zone and method free-above thresholds depend on it, as at checkout. */
  priceCents: number;
}

/**
 * What the checkout's delivery step would offer for this product: the same
 * server quote (opt-in methods, free shipping with its paid upgrades, zone
 * surcharges, free-above thresholds) for a basket of just this product.
 *
 * For the visitor's country — the one they picked at checkout, else their
 * IP's — when the shop ships there; otherwise every option offered anywhere,
 * each once. Never zones or shipping settings: only what a customer would be
 * offered.
 * Open by default and fetched on mount; fetched again if the price changes
 * while open.
 */
export default function DeliveryDetails({ locale, productId, priceCents }: Props) {
  const t = getTranslations(locale).shop;
  // Open on arrival; the customer can fold it away.
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [options, setOptions] = useState<DeliveryOptions | null>(null);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const key = `${productId}:${priceCents}`;
    if (loadedFor.current === key) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchProductDeliveryOptions(productId, priceCents, locale)
      .then((data) => {
        if (cancelled) return;
        loadedFor.current = key;
        setOptions(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, productId, priceCents, locale]);

  // A plain item: dated exactly as the checkout dates a basket without embroidery.
  const arrival = (m: QuotedMethod) => formatArrival(deliveryWindow(m, 0), locale, t);

  const methodRow = (m: QuotedMethod, freeShipping: boolean) => {
    const logo = carrierLogo(m);
    // The free-shipping option is synthetic and named in English by the server.
    const name = freeShipping && m.isFree ? t.freeShippingBadge : m.name;
    return (
      <li className={styles.deliveryMethodRow} key={m.id}>
        <span className={styles.deliveryMethodMain}>
          <span className={styles.deliveryMethodName}>
            {logo && <Image src={logo} alt="" width={22} height={22} unoptimized className={styles.deliveryCarrierLogo} />}
            {name}
          </span>
          <span className={styles.deliveryMethodDays}>{arrival(m)}</span>
        </span>
        <span className={styles.deliveryMethodMeta}>
          <span className={styles.deliveryMethodPrice}>
            {m.isFree ? (
              <>
                {m.originalPriceCents > 0 && <s className={styles.deliveryMethodStruck}>{centsToEuros(m.originalPriceCents)} €</s>}
                {t.deliveryDetailsFree}
              </>
            ) : (
              `${centsToEuros(m.priceCents)} €`
            )}
          </span>
        </span>
      </li>
    );
  };

  const methods = options?.methods ?? [];

  return (
    <details className={styles.deliverySection} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={styles.deliveryToggle}>
        <span className={styles.deliveryToggleLabel}>
          <Truck size={16} className={styles.deliveryToggleIcon} aria-hidden="true" />
          {t.deliveryDetailsTitle}
        </span>
        <span className={styles.deliveryChevron} aria-hidden="true" />
      </summary>

      <div className={styles.deliveryBody}>
        {loading && <p className={styles.deliveryState}>{t.deliveryDetailsLoading}</p>}
        {!loading && error && <p className={styles.deliveryState}>{t.deliveryDetailsError}</p>}
        {!loading && !error && options && methods.length === 0 && <p className={styles.deliveryState}>{t.deliveryDetailsEmpty}</p>}

        {!loading && !error && options && methods.length > 0 && (
          <div className={styles.deliveryZone}>
            {options.country && <div className={styles.deliveryZoneName}>{t.deliveryDetailsTo.replace("{country}", countryName(options.country, locale))}</div>}
            <ul className={styles.deliveryMethodList}>{methods.map((m) => methodRow(m, options.freeShipping))}</ul>
          </div>
        )}
      </div>
    </details>
  );
}
