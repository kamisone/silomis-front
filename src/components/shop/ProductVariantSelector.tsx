"use client";

import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import type { VariantSelection } from "./useVariantSelection";
import styles from "./ProductVariantSelector.module.css";

export type {
  AttrGroup,
  AttrOption,
  OptionState,
  SelectableVariant,
  VariantAttributeRef,
  VariantOptionRow,
  VariantOptionValue,
  VariantSelection,
} from "./useVariantSelection";

/**
 * The inline variation picker in the product details column.
 *
 * Presentational only: selection lives in useVariantSelection, called once by
 * the page so this and StickyVariantSelector share it.
 */
export default function ProductVariantSelector({ selection }: { selection: VariantSelection }) {
  const t = getTranslations(useLocale());
  const { attributes, hasVariations, sel, optionState, pick } = selection;

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
