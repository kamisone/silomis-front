"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Truck } from "lucide-react";
import { getTranslations, toBcp47, type Locale } from "@/lib/i18n";
import { deliveryWindow, type DeliveryWindow } from "@/lib/shop/deliveryDates";
import { fetchProductDeliveryOptions } from "@/lib/shop/productDeliveryOptions";
import styles from "./ProductDetail.module.css";

/** 🇫🇷 from "FR": two regional-indicator letters. */
export function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** "France" in the shop language, from the browser's own CLDR data. */
export function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([toBcp47(locale)], { type: "region", fallback: "code" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** "21 Oct" — day and month only, in the shop language's order. */
function shortDate(date: Date, locale: Locale): string {
  return date.toLocaleDateString(toBcp47(locale), { day: "numeric", month: "short" });
}

const sameWindow = (a: DeliveryWindow, b: DeliveryWindow) => a.earliest.getTime() === b.earliest.getTime() && a.latest.getTime() === b.latest.getTime();

/**
 * The midnight at which ordering stops giving `now`'s delivery dates. Over a
 * weekend that is Monday's midnight, not tonight's: Saturday and Sunday
 * orders leave on the same business day.
 */
function nextDateChange(days: { estimatedDaysMin: number; estimatedDaysMax: number }, now: Date): Date {
  const current = deliveryWindow(days, 0, now);
  for (let i = 1; i <= 7; i++) {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (!sameWindow(deliveryWindow(days, 0, midnight), current)) return midnight;
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/** "10:11 min" under an hour (ticking seconds), "5 h 12 min" above it. */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} min`;
}

/** Fills a "{token}" template with nodes, so the values can be emphasised. */
function fill(template: string, values: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1];
    return <Fragment key={i}>{key && key in values ? values[key] : part}</Fragment>;
  });
}

interface Props {
  locale: Locale;
  productId: string;
  priceCents: number;
  /** The product's own free-shipping estimate — used until (or unless) the visitor's country quote says otherwise. */
  daysMin: number | null | undefined;
  daysMax: number | null | undefined;
}

/**
 * "Free shipping to 🇫🇷 France — order within the next 10:11 min to receive it
 * between 21 Oct and 22 Oct".
 *
 * The country is the one the checkout would quote (checkout hint, else IP),
 * and only when the shop ships there; otherwise the title is plain "Free
 * shipping". The countdown is honest: it runs to the midnight after which an
 * order would get later dates, and the dates move when it reaches zero.
 * Everything time-based renders after mount — the server does not know the
 * visitor's clock.
 */
export default function FreeShippingBanner({ locale, productId, priceCents, daysMin, daysMax }: Props) {
  const t = getTranslations(locale).shop;
  const [country, setCountry] = useState<string | null>(null);
  const [quotedDays, setQuotedDays] = useState<{ estimatedDaysMin: number; estimatedDaysMax: number } | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProductDeliveryOptions(productId, priceCents, locale)
      .then((data) => {
        if (cancelled) return;
        setCountry(data.country);
        // The free option the checkout would offer, with its own estimate —
        // also when the country is unknown: the fallback quote still has it.
        const free = data.methods.find((m) => m.isFree);
        setQuotedDays(free ? { estimatedDaysMin: free.estimatedDaysMin, estimatedDaysMax: free.estimatedDaysMax } : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productId, priceCents, locale]);

  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
    };
  }, []);

  const days = quotedDays ?? (daysMax != null ? { estimatedDaysMin: daysMin ?? daysMax, estimatedDaysMax: daysMax } : null);

  let deliveryLine: ReactNode = null;
  if (days && now) {
    const win = deliveryWindow(days, 0, now);
    const time = <strong className={styles.freeShippingCountdown}>{formatCountdown(nextDateChange(days, now).getTime() - now.getTime())}</strong>;
    deliveryLine =
      win.earliest.getTime() === win.latest.getTime()
        ? fill(t.freeShippingOrderWithinOn, { time, date: <strong>{shortDate(win.latest, locale)}</strong> })
        : fill(t.freeShippingOrderWithinBetween, { time, from: <strong>{shortDate(win.earliest, locale)}</strong>, to: <strong>{shortDate(win.latest, locale)}</strong> });
  }

  return (
    <div className={styles.freeShippingBanner}>
      <span className={styles.freeShippingIcon} aria-hidden="true">
        <Truck size={18} strokeWidth={2.2} />
      </span>
      <span className={styles.freeShippingText}>
        <strong className={styles.freeShippingTitle}>
          {country
            ? fill(t.freeShippingTo, {
                country: (
                  <span className={styles.freeShippingCountry}>
                    <span aria-hidden="true">{flagEmoji(country)}</span> {countryName(country, locale)}
                  </span>
                ),
              })
            : t.freeShippingBadge}
        </strong>
        {deliveryLine && (
          <span className={styles.freeShippingDays} aria-live="off">
            {deliveryLine}
          </span>
        )}
      </span>
    </div>
  );
}
