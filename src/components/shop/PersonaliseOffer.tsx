"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useCart, type CartItem } from "./CartContext";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./PersonaliseOffer.module.css";

export type PersonaliseOrigin = "drawer" | "cart" | "checkout";

/**
 * "from €10.00" for an embroidery button, or null when the price is unknown
 * (a backend that predates the field) — the button then shows no price rather
 * than a wrong one. A cheapest position priced at zero reads as "Free".
 */
export function embroideryFromLabel(cents: number | null | undefined, locale: Locale): string | null {
  if (cents === null || cents === undefined) return null;
  const c = getTranslations(locale).personalize;
  return cents === 0 ? c.priceFree : c.fromPrice.replace("{price}", `€${(cents / 100).toFixed(2)}`);
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
 * Opens the editor on one unit of this line. `line` makes the editor replace
 * that unit instead of adding a new one; `from` decides where it returns.
 * The drawer has no page of its own, so it also hands over the page it was
 * opened on.
 */
export function personaliseHref(item: CartItem, locale: Locale, from: PersonaliseOrigin, returnPath?: string, edit = false): string {
  const qs = new URLSearchParams({ v: item.variantId, line: item.id, from });
  if (from === "drawer" && returnPath) qs.set("return", returnPath);
  if (edit) qs.set("edit", "1");
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
  const price = embroideryFromLabel(item.personalizeFromCents, locale);

  return (
    <Link href={personaliseHref(item, locale, from, returnPath)} className={styles.offer} onClick={onNavigate}>
      <span className={styles.icon} aria-hidden="true">
        <Sparkles size={14} />
      </span>
      <span className={styles.body}>
        <span className={styles.head}>
          <span className={styles.title}>{c.offerTitle}</span>
          {price && <span className={styles.price}>{price}</span>}
        </span>
        <span className={styles.sub}>{c.offerSub}</span>
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
