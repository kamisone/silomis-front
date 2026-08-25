"use client";

import { useMemo, useState } from "react";

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

export interface AttrOption {
  key: string;
  optionValueId: string | null;
  value: string;
  displayValue: string | null;
  swatchValue: string | null;
  swatchType: "color" | "image" | null;
  sortOrder: number;
}

export interface AttrGroup {
  id: string;
  name: string;
  displayType: "swatch" | "button" | "dropdown";
  sortOrder: number;
  options: AttrOption[];
}

export type OptionState = "selected" | "available" | "oos" | "unavailable";

export interface VariantSelection {
  /** Attribute groups in sort order, each with its de-duplicated option list. */
  attributes: AttrGroup[];
  /** False when no variant carries options — callers should render no picker at all. */
  hasVariations: boolean;
  /** attributeId -> selected option key. */
  sel: Record<string, string>;
  /** The variant matching the full current selection, or null while it is incomplete. */
  currentVariant: SelectableVariant | null;
  optionState: (attrId: string, key: string) => OptionState;
  pick: (attrId: string, key: string) => void;
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

/**
 * Owns variant-option selection for one product.
 *
 * Deliberately a hook rather than component-local state: the product page
 * renders the picker twice — inline in the details column and again inside the
 * sticky mobile buy bar (see ProductVariantSelector / StickyVariantSelector).
 * Calling this once in the parent and passing the result to both makes a single
 * source of truth for `sel` structural, so the two pickers cannot diverge.
 */
export function useVariantSelection(variants: SelectableVariant[]): VariantSelection {
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

  // Lazy initial value only — the product page keys this whole subtree on
  // product.id (see page.tsx), so a genuinely new product set always comes
  // through as a fresh mount rather than a prop change, and no re-sync
  // effect is needed.
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

  return { attributes, hasVariations, sel, currentVariant, optionState, pick };
}
