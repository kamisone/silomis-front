import { toBcp47, type Locale } from "@/lib/i18n";

/**
 * Turns "3–5 business days" into the dates a customer can plan around.
 *
 * Every estimate in the shop is in business days: the shipping methods'
 * min/max ("3-5 business days" in the admin) and the embroidery production
 * time. Weekends are skipped; public holidays are not known here, which only
 * ever makes a date a day optimistic around a holiday — the range absorbs it.
 *
 * Counted from the customer's own today, in their own time zone: the date is
 * read on their screen, and "arrives Friday" has to mean their Friday.
 */

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** `days` business days after `from` (0 = `from` itself, rolled past a weekend). */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let left = Math.max(0, Math.floor(days));
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) left--;
  }
  return d;
}

export interface DeliveryWindow {
  /** When the order leaves — only meaningful with production time before it. */
  ships: Date;
  earliest: Date;
  latest: Date;
}

/**
 * The window a shipping method delivers in, after `productionDays` of making
 * the order (0 for a basket without embroidery).
 */
export function deliveryWindow(method: { estimatedDaysMin: number; estimatedDaysMax: number }, productionDays = 0, today = new Date()): DeliveryWindow {
  const min = Math.max(0, method.estimatedDaysMin);
  const max = Math.max(min, method.estimatedDaysMax);
  return {
    ships: addBusinessDays(today, productionDays),
    earliest: addBusinessDays(today, productionDays + min),
    latest: addBusinessDays(today, productionDays + max),
  };
}

/** "Fri 17 Oct", in the shop language's own order and abbreviations. */
export function formatDay(date: Date, locale: Locale, withMonth = true): string {
  return date.toLocaleDateString(toBcp47(locale), { weekday: "short", day: "numeric", ...(withMonth ? { month: "short" } : {}) });
}

/**
 * "Arrives between Tue 14 and Fri 17 Oct" — the month said once when both
 * dates share it — or "Arrives Fri 17 Oct" for a one-day window.
 */
export function formatArrival(win: DeliveryWindow, locale: Locale, labels: { arrivesBetween: string; arrivesOn: string }): string {
  const { earliest, latest } = win;
  if (earliest.getTime() === latest.getTime()) return labels.arrivesOn.replace("{date}", formatDay(latest, locale));
  const sameMonth = earliest.getMonth() === latest.getMonth() && earliest.getFullYear() === latest.getFullYear();
  return labels.arrivesBetween.replace("{from}", formatDay(earliest, locale, !sameMonth)).replace("{to}", formatDay(latest, locale));
}
