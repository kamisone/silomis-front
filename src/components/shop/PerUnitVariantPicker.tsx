"use client";

import { useMemo } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { SelectableVariant } from "./useVariantSelection";
import styles from "./PerUnitVariantPicker.module.css";

interface Props {
  /** One entry per unit, in order. Length always matches the quantity control. */
  units: string[];
  variants: SelectableVariant[];
  /** Reports a single row, so rows the customer never touched keep following the main selector. */
  onUnitChange: (index: number, variantId: string) => void;
  /** Drops one pair. The row index, not the variant: two rows can hold the same
   *  combination and only the one the shopper pointed at should go. */
  onUnitRemove: (index: number) => void;
  formatPrice: (cents: number) => string;
  labels: {
    title: string;
    unit: string;
    /** "{n} left" — {n} is replaced with the remaining stock. */
    remaining: string;
    outOfStock: string;
    /** "Only {n} of {name} available" — over-allocation warning. */
    overAllocated: string;
    /** "Remove pair {n}" — the row button's accessible name. */
    remove: string;
  };
}

/** Human label for a variant: its own title, else its options joined. */
export function variantLabel(variant: SelectableVariant): string {
  if (variant.title?.trim()) return variant.title.trim();
  const parts = (variant.options ?? []).map((o) => o.optionValue?.displayValue ?? o.value).filter(Boolean);
  return parts.length ? parts.join(" / ") : (variant.sku ?? "");
}

/**
 * Lets each unit of a multi-unit purchase be a different variant — three shirts
 * in three sizes, without going through the product page three times.
 *
 * Stock is checked per variant across the whole selection, not per row: picking
 * the same size for four units when three remain is the failure this catches,
 * and it has to be caught here rather than at add-to-cart, where the customer
 * would have lost their choices.
 *
 * Prices are shown per row only when the variants actually differ in price, so
 * the common case stays quiet.
 *
 * Deliberately spare on words: a heading plus one numbered row per pair says
 * what this does. An explanatory line underneath had to name the attributes to
 * be worth reading ("mix sizes and colours"), and those are per-product — a
 * variant here can just as easily be Colour / Size / Width.
 */
export default function PerUnitVariantPicker({ units, variants, onUnitChange, onUnitRemove, formatPrice, labels }: Props) {
  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);

  /** How many units are currently assigned to each variant. */
  const allocated = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of units) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  }, [units]);

  // Only worth showing per-row prices when there is a difference to explain.
  const pricesDiffer = useMemo(() => new Set(variants.map((v) => v.priceCents)).size > 1, [variants]);

  const overAllocated = useMemo(
    () =>
      [...allocated.entries()]
        .map(([id, count]) => ({ variant: byId.get(id), count }))
        .filter((row): row is { variant: SelectableVariant; count: number } => !!row.variant)
        .filter((row) => row.count > (row.variant.inventoryItem?.available ?? 0)),
    [allocated, byId],
  );

  return (
    <div className={styles.card}>
      <span className={styles.title}>{labels.title}</span>

      <ul className={styles.list}>
        {units.map((variantId, index) => {
          const variant = byId.get(variantId);
          const available = variant?.inventoryItem?.available ?? 0;
          const rowId = `unit-${index}`;
          return (
            <li key={rowId} className={styles.row}>
              <label className={styles.rowLabel} htmlFor={rowId}>
                {labels.unit.replace("{n}", String(index + 1))}
              </label>
              <select id={rowId} className={styles.select} value={variantId} onChange={(e) => onUnitChange(index, e.target.value)}>
                {variants.map((option) => {
                  const stock = option.inventoryItem?.available ?? 0;
                  return (
                    // Kept selectable when out of stock so the current choice
                    // never vanishes from its own dropdown; the warning below
                    // is what blocks the purchase.
                    <option key={option.id} value={option.id} disabled={stock <= 0 && option.id !== variantId}>
                      {variantLabel(option)}
                      {stock <= 0 ? ` — ${labels.outOfStock}` : ""}
                      {pricesDiffer ? ` · ${formatPrice(option.priceCents)}` : ""}
                    </option>
                  );
                })}
              </select>
              {available > 0 && available <= 5 && <span className={styles.stock}>{labels.remaining.replace("{n}", String(available))}</span>}
              {/* Always offered, including on the last two rows: dropping to a
                  single pair simply closes this picker, which is a normal way
                  to back out of a mixed order rather than an error. */}
              <button
                type="button"
                className={styles.remove}
                onClick={() => onUnitRemove(index)}
                aria-label={labels.remove.replace("{n}", String(index + 1))}
                title={labels.remove.replace("{n}", String(index + 1))}
              >
                <X size={14} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      {overAllocated.map(({ variant, count }) => (
        <p key={variant.id} className={styles.warning} role="status">
          <AlertTriangle size={13} aria-hidden="true" />
          {labels.overAllocated.replace("{n}", String(variant.inventoryItem?.available ?? 0)).replace("{name}", variantLabel(variant))}
          {` (${count} selected)`}
        </p>
      ))}
    </div>
  );
}

/**
 * Groups per-unit choices into the add-to-cart calls they imply: one entry per
 * distinct variant with how many units it covers. Order follows first
 * appearance, so the cart ends up in the order the customer built it.
 */
export function groupUnits(units: string[]): Array<{ variantId: string; quantity: number }> {
  const grouped: Array<{ variantId: string; quantity: number }> = [];
  for (const variantId of units) {
    const existing = grouped.find((g) => g.variantId === variantId);
    if (existing) existing.quantity += 1;
    else grouped.push({ variantId, quantity: 1 });
  }
  return grouped;
}
