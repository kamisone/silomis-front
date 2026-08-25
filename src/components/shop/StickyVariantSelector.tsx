"use client";

import { Check } from "lucide-react";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import type { VariantSelection } from "./useVariantSelection";
import styles from "./StickyVariantSelector.module.css";

/**
 * Compact variation picker for the sticky mobile buy bar — shown once the
 * inline ProductVariantSelector has scrolled out of view, so the customer can
 * still switch size/colour without scrolling back up.
 *
 * Renders every display type the inline selector supports (swatch, button,
 * dropdown), so it is a genuine replacement rather than a partial one. Each
 * attribute is a single horizontally scrolling row to keep the bar short on a
 * product with several attributes.
 *
 * Takes the same VariantSelection object the inline selector is given, so both
 * read and write one `sel` — picking here and picking there cannot diverge.
 */
export default function StickyVariantSelector({ selection, visible }: { selection: VariantSelection; visible: boolean }) {
  const t = getTranslations(useLocale());
  const { attributes, hasVariations, sel, optionState, pick } = selection;

  if (!hasVariations) return null;

  return (
    <div className={styles.root}>
      {attributes.map((attr) => {
        const selectedOpt = attr.options.find((o) => sel[attr.id] === o.key);
        return (
          <div key={attr.id} className={styles.group}>
            <span className={styles.label}>
              {attr.name}
              {selectedOpt && <span className={styles.labelValue}>{selectedOpt.displayValue ?? selectedOpt.value}</span>}
            </span>

            {attr.displayType === "dropdown" ? (
              <select
                className={styles.select}
                value={sel[attr.id] ?? ""}
                onChange={(e) => pick(attr.id, e.target.value)}
                aria-label={attr.name}
                // Keep the collapsed bar out of the tab order entirely.
                tabIndex={visible ? 0 : -1}
              >
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
            ) : (
              <div className={styles.optionRow}>
                {attr.options.map((o) => {
                  const state = optionState(attr.id, o.key);
                  const isSwatch = attr.displayType === "swatch";
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
                      tabIndex={visible ? 0 : -1}
                      className={[
                        isSwatch ? styles.swatchBtn : styles.optionBtn,
                        state === "selected" ? styles.optionSelected : "",
                        state === "oos" ? styles.optionOos : "",
                        state === "unavailable" ? styles.optionUnavailable : "",
                      ].join(" ")}
                    >
                      {isSwatch ? (
                        <>
                          {bg ? <span className={styles.swatchInner} style={{ background: bg }} /> : <span className={styles.swatchTextInner}>{o.displayValue ?? o.value}</span>}
                          {state === "selected" && (
                            <span className={styles.check} aria-hidden="true">
                              <Check size={9} strokeWidth={3} />
                            </span>
                          )}
                        </>
                      ) : (
                        o.displayValue ?? o.value
                      )}
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
