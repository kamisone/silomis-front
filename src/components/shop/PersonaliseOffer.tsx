"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles, ChevronRight, Pencil, Trash2, Gift } from "lucide-react";
import { useCart, type CartItem } from "./CartContext";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./PersonaliseOffer.module.css";

export type PersonaliseOrigin = "drawer" | "cart" | "checkout";

/** What a product says about embroidery price before the editor opens. */
export interface EmbroideryPricing {
  fromCents?: number | null;
  /** Positions the shop embroiders for free, already in the page's language. */
  freePositions?: string[] | null;
  /** Every position is free. */
  allFree?: boolean | null;
}

/**
 * The price line for an embroidery button.
 *
 * - `price`: "from €10.00", or null when nothing is charged up front or the
 *   price is unknown (a backend that predates the field) — the button then
 *   shows no price rather than a wrong one.
 * - `freeLine`: when at least one position is free, the sentence that says
 *   so — naming the positions unless every one of them is free, because a
 *   bare "Free" on a product whose back panel costs €8 reads as a promise
 *   the editor would then break.
 */
export function embroideryPricing({ fromCents, freePositions, allFree }: EmbroideryPricing, locale: Locale): { price: string | null; freeLine: string | null } {
  const c = getTranslations(locale).personalize;
  const names = freePositions?.filter(Boolean) ?? [];
  if (allFree) return { price: null, freeLine: c.freeAll };
  if (names.length) return { price: null, freeLine: c.freeOn.replace("{positions}", listOf(names, locale)) };
  if (fromCents === null || fromCents === undefined) return { price: null, freeLine: null };
  // A zero minimum with no names: a backend that predates freePositions.
  if (fromCents === 0) return { price: null, freeLine: c.freeAll };
  return { price: c.fromPrice.replace("{price}", `€${(fromCents / 100).toFixed(2)}`), freeLine: null };
}

/** "Front panel, Side and Back" in the page's own language. */
function listOf(items: string[], locale: Locale): string {
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

/**
 * The "Free" pill — brand pink, so a free position is the first thing seen on
 * any embroidery button or position card. `size="sm"` for tight spots (the
 * editor's item tabs and position captions).
 */
export function FreeEmbroideryBadge({ locale, size = "md", className }: { locale: Locale; size?: "sm" | "md"; className?: string }) {
  return (
    <span className={`${styles.freeBadge} ${size === "sm" ? styles.freeBadgeSm : ""} ${className ?? ""}`}>
      <Gift size={size === "sm" ? 10 : 12} strokeWidth={2.5} aria-hidden="true" />
      {getTranslations(locale).personalize.priceFree}
    </span>
  );
}

/**
 * Whether a basket line can still be offered embroidery: its product takes it
 * and this line is plain. A line that is already embroidered is not offered a
 * second design — the customer edits by removing it and starting again.
 */
export function canOfferPersonalisation(item: CartItem): boolean {
  return !!item.personalizable && !item.personalizations?.length && !!item.productSlug;
}

/**
 * Opens the editor on this line. `line` makes the editor personalise the
 * line's units instead of adding new ones — every unit, one design each, as
 * on the product page (`qty`); `from` decides where it returns.
 * The drawer has no page of its own, so it also hands over the page it was
 * opened on.
 */
export function personaliseHref(item: CartItem, locale: Locale, from: PersonaliseOrigin, returnPath?: string, edit = false): string {
  const qs = new URLSearchParams({ v: item.variantId, line: item.id, from });
  if (from === "drawer" && returnPath) qs.set("return", returnPath);
  if (edit) qs.set("edit", "1");
  else if (item.quantity > 1) qs.set("qty", String(item.quantity));
  return `/${locale}/shop/${item.productSlug}/personalise?${qs.toString()}`;
}

/**
 * The "you can still embroider this one" offer, under a plain line in the
 * drawer, the basket and checkout's first step — for customers who never saw,
 * or skipped, "Personalise this piece" on the product page.
 */
export default function PersonaliseOffer({
  item,
  locale,
  from,
  returnPath,
  onNavigate,
}: {
  item: CartItem;
  locale: Locale;
  from: PersonaliseOrigin;
  returnPath?: string;
  onNavigate?: () => void;
}) {
  if (!canOfferPersonalisation(item)) return null;
  const c = getTranslations(locale).personalize;
  const { price, freeLine } = embroideryPricing(
    { fromCents: item.personalizeFromCents, freePositions: item.personalizeFreePositions, allFree: item.personalizeAllFree },
    locale,
  );

  return (
    <Link
      href={personaliseHref(item, locale, from, returnPath)}
      className={`${styles.offer} ${freeLine ? styles.offerFree : ""}`}
      onClick={onNavigate}
    >
      <span className={styles.icon} aria-hidden="true">
        <Sparkles size={14} />
      </span>
      <span className={styles.body}>
        <span className={styles.head}>
          <span className={styles.title}>{c.offerTitle}</span>
          {freeLine ? <FreeEmbroideryBadge locale={locale} size="sm" /> : price && <span className={styles.price}>{price}</span>}
        </span>
        {freeLine ? <span className={styles.freeLine}>{freeLine}</span> : <span className={styles.sub}>{c.offerSub}</span>}
      </span>
      <ChevronRight size={15} className={styles.chevron} aria-hidden="true" />
    </Link>
  );
}

/**
 * Edit / remove for a line that is already embroidered. Remove asks for a
 * second tap: the design is lost with it, and the button sits where a thumb
 * scrolling the list can brush it. The confirmation lapses on its own.
 */
export function PersonalisedLineActions({ item, locale, from }: { item: CartItem; locale: Locale; from: PersonaliseOrigin }) {
  const { removeDesign, mutating } = useCart();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);
  const c = getTranslations(locale).personalize;

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  if (!item.personalizations?.length || !item.productSlug) return null;

  async function onRemove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    const result = await removeDesign(item.id);
    setError(!result.ok);
  }

  return (
    <span className={styles.actions}>
      <Link href={personaliseHref(item, locale, from, undefined, true)} className={styles.action}>
        <Pencil size={13} aria-hidden="true" />
        {c.editDesign}
      </Link>
      <button type="button" className={`${styles.action} ${styles.actionDanger} ${confirming ? styles.actionConfirm : ""}`} onClick={onRemove} disabled={mutating}>
        <Trash2 size={13} aria-hidden="true" />
        {confirming ? c.confirmRemoveDesign : c.removeDesign}
      </button>
      {error && <span className={styles.actionError}>{c.errors.addFailed}</span>}
    </span>
  );
}
