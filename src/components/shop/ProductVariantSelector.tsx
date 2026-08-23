"use client";

import { useEffect, useMemo, useState } from "react";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./ProductVariantSelector.module.css";

export interface VariantOptionValue {
  id: string;
  value: string;
  displayValue: string | null;
  swatchValue: string | null;
  swatchType: "color" | "image" | null;
  sortOrder: number;
}

export interface VariantAttributeRef {
  id: string;
  name: string;
  displayType: "swatch" | "button" | "dropdown";
  sortOrder: number;
}

export interface VariantOptionRow {
  attributeId: string;
  optionValueId: string | null;
  value: string;
  optionValue: VariantOptionValue | null;
  attribute: VariantAttributeRef;
}

export interface SelectableVariant {
  id: string;
  sku: string | null;
  title: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  isDefault: boolean;
  options: VariantOptionRow[];
  inventoryItem: { available: number } | null;
}

interface AttrOption {
  key: string;
  optionValueId: string | null;
  value: string;
  displayValue: string | null;
  swatchValue: string | null;
  swatchType: "color" | "image" | null;
  sortOrder: number;
}

interface AttrGroup {
  id: string;
  name: string;
  displayType: "swatch" | "button" | "dropdown";
  sortOrder: number;
  options: AttrOption[];
}

type OptionState = "selected" | "available" | "oos" | "unavailable";

interface Props {
  variants: SelectableVariant[];
  onVariantChange?: (variant: SelectableVariant | null) => void;
}

/** A variant's option is identified by its global optionValueId when linked to a
 * shared VariationOptionValue row, or by an attribute-scoped fallback key for
 * legacy free-text options (optionValueId === null) — prefixed with the
 * attributeId so two different attributes' free-text values can't collide. */
function optionKey(o: VariantOptionRow): string {
  return o.optionValueId ?? `${o.attributeId}::${o.value}`;
}

function isAvailable(v: SelectableVariant): boolean {
  return (v.inventoryItem?.available ?? 0) > 0;
}

export default function ProductVariantSelector({ variants, onVariantChange }: Props) {
  const t = getTranslations(useLocale());
  const variantsWithOptions = useMemo(() => variants.filter((v) => v.options.length > 0), [variants]);

  const attributes = useMemo((): AttrGroup[] => {
    const map = new Map<string, AttrGroup>();
    for (const v of variantsWithOptions) {
      for (const o of v.options) {
        let group = map.get(o.attributeId);
        if (!group) {
          group = { id: o.attributeId, name: o.attribute.name, displayType: o.attribute.displayType, sortOrder: o.attribute.sortOrder, options: [] };
          map.set(o.attributeId, group);
        }
        const key = optionKey(o);
        if (!group.options.some((opt) => opt.key === key)) {
          group.options.push({
            key,
            optionValueId: o.optionValueId,
            value: o.value,
            displayValue: o.optionValue?.displayValue ?? null,
            swatchValue: o.optionValue?.swatchValue ?? null,
            swatchType: o.optionValue?.swatchType ?? null,
            sortOrder: o.optionValue?.sortOrder ?? 0,
          });
        }
      }
    }
    return [...map.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => ({ ...g, options: [...g.options].sort((a, b) => a.sortOrder - b.sortOrder) }));
  }, [variantsWithOptions]);

  const hasVariations = attributes.length > 0;

  const initialSel = useMemo((): Record<string, string> => {
    if (!variantsWithOptions.length) return {};
    const preferred = variantsWithOptions.find((v) => v.isDefault) ?? variantsWithOptions.find(isAvailable) ?? variantsWithOptions[0];
    const sel: Record<string, string> = {};
    for (const o of preferred.options) sel[o.attributeId] = optionKey(o);
    return sel;
  }, [variantsWithOptions]);

  // Lazy initial value only — the parent page keys this whole subtree on
  // product.id (see ShopProductDetail), so a genuinely new product set
  // always comes through as a fresh mount rather than a prop change on this
  // instance, and no re-sync effect is needed.
  const [sel, setSel] = useState<Record<string, string>>(initialSel);

  const currentVariant = useMemo((): SelectableVariant | null => {
    if (!hasVariations) return variants.find((v) => v.isDefault) ?? variants[0] ?? null;
    const selValues = Object.values(sel);
    if (selValues.length !== attributes.length) return null;
    return (
      variantsWithOptions.find((v) => {
        const keys = v.options.map(optionKey);
        return keys.length === attributes.length && selValues.every((k) => keys.includes(k));
      }) ?? null
    );
  }, [sel, attributes, variantsWithOptions, hasVariations, variants]);

  useEffect(() => {
    onVariantChange?.(currentVariant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVariant]);

  function optionState(attrId: string, key: string): OptionState {
    if (sel[attrId] === key) return "selected";
    const hypothetical = { ...sel, [attrId]: key };
    const hvValues = Object.values(hypothetical);
    const matches = variantsWithOptions.filter((v) => {
      const keys = v.options.map(optionKey);
      return hvValues.every((k) => keys.includes(k));
    });
    if (matches.length === 0) return "unavailable";
    if (matches.some(isAvailable)) return "available";
    return "oos";
  }

  function pick(attrId: string, key: string) {
    if (optionState(attrId, key) === "unavailable") return;
    setSel((prev) => ({ ...prev, [attrId]: key }));
  }

  if (!hasVariations) return null;

  return (
    <div className={styles.root}>
      {attributes.map((attr) => {
        const selectedOpt = attr.options.find((o) => sel[attr.id] === o.key);
        return (
          <div key={attr.id} className={styles.attrGroup}>
            <div className={styles.attrLabel}>
              {attr.name}
              {selectedOpt && <span className={styles.attrSelected}> — {selectedOpt.displayValue ?? selectedOpt.value}</span>}
            </div>

            {attr.displayType === "dropdown" ? (
              <select className={styles.attrSelect} value={sel[attr.id] ?? ""} onChange={(e) => pick(attr.id, e.target.value)}>
                <option value="" disabled>
                  {t.shop.selectPrefix} {attr.name}
                </option>
                {attr.options.map((o) => {
                  const state = optionState(attr.id, o.key);
                  return (
                    <option key={o.key} value={o.key} disabled={state === "unavailable"}>
                      {o.displayValue ?? o.value}
                      {state === "oos" ? ` (${t.shop.stockOutOfStock})` : ""}
                    </option>
                  );
                })}
              </select>
            ) : attr.displayType === "swatch" ? (
              <div className={styles.optionRow}>
                {attr.options.map((o) => {
                  const state = optionState(attr.id, o.key);
                  const isImage = o.swatchType === "image";
                  const bg = o.swatchType === "color" ? o.swatchValue ?? undefined : isImage && o.swatchValue ? `url(${o.swatchValue}) center/cover` : undefined;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => pick(attr.id, o.key)}
                      disabled={state === "unavailable"}
                      title={o.displayValue ?? o.value}
                      aria-label={o.displayValue ?? o.value}
                      aria-pressed={state === "selected"}
                      className={[styles.swatchBtn, state === "selected" ? styles.optionSelected : "", state === "oos" ? styles.optionOos : "", state === "unavailable" ? styles.optionUnavailable : ""].join(" ")}
                    >
                      {bg ? <span className={styles.swatchInner} style={{ background: bg }} /> : <span className={styles.swatchTextInner}>{o.displayValue ?? o.value}</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={styles.optionRow}>
                {attr.options.map((o) => {
                  const state = optionState(attr.id, o.key);
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => pick(attr.id, o.key)}
                      disabled={state === "unavailable"}
                      aria-pressed={state === "selected"}
                      className={[styles.optionBtn, state === "selected" ? styles.optionSelected : "", state === "oos" ? styles.optionOos : "", state === "unavailable" ? styles.optionUnavailable : ""].join(" ")}
                    >
                      {o.displayValue ?? o.value}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
