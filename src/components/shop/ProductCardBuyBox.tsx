"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import AddToCartButton from "./AddToCartButton";
import { useCart } from "./CartContext";
import { useCardVariant } from "./ProductCardVariantContext";
import type { AttrGroup, SelectableVariant } from "./useVariantSelection";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./ProductCardBuyBox.module.css";

/** Above this an attribute is a dropdown whatever the admin chose — a card is
 *  too narrow for a dozen swatches, and a wrapped 4-row grid buries the price. */
const MAX_INLINE_OPTIONS = 6;
const MAX_QTY = 99;

function optionLabel(o: AttrGroup["options"][number]): string {
  return o.displayValue ?? o.value;
}

/**
 * Pick the options and add that one combination straight from the card.
 *
 * Quantity applies to a single resolved variant on purpose — "4 × Black / M",
 * never four different pairs. Mixing combinations is a per-unit choice, which
 * is the product page's PerUnitVariantPicker, not a card control.
 *
 * The options themselves are collapsed by default. A grid of cards is a
 * scanning surface first: the default combination is already selected, so the
 * common path is one click on Add, and a card that opens with three rows of
 * swatches pushes the price and the button out of a uniform grid. The summary
 * row keeps the current combination visible, and opening it is one click.
 */
export default function ProductCardBuyBox({ href }: { href: string }) {
  const locale = useLocale();
  const t = getTranslations(locale);
  const card = useCardVariant();
  const { cart } = useCart();
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!card) return null;
  const { attributes, hasVariations, sel, optionState, pick, currentVariant } = card.selection;
  if (!hasVariations) return null;

  const variant = currentVariant as (SelectableVariant & { featuredMediaUrl?: string | null }) | null;
  const available = variant?.inventoryItem?.available ?? 0;
  const inCart = !!variant && !!cart?.items.some((i) => i.variantId === variant.id);
  // available is 0 for a variant with no inventory row at all, which means
  // "untracked", not "sold out" — the picker's own optionState already marks
  // genuinely sold-out combinations, so only cap when a row exists.
  const maxQty = variant?.inventoryItem ? Math.min(available, MAX_QTY) : MAX_QTY;
  const soldOut = !!variant?.inventoryItem && available <= 0;
  // Derived rather than reset in an effect: switching from a size with 8 in
  // stock to one with 2 must not carry a quantity of 4 into a request the
  // server is bound to reject.
  const qtyToAdd = Math.max(1, Math.min(qty, maxQty));

  const selectedOptionValueIds = variant?.options.map((o) => o.optionValueId).filter((id): id is string => !!id) ?? [];
  const comboLabel = attributes
    .map((a) => a.options.find((o) => o.key === sel[a.id]))
    .filter(Boolean)
    .map((o) => optionLabel(o!))
    .join(" / ");

  return (
    <div className={styles.root}>
      {/* Trigger and panel share one wrapper so a collapsed panel — still a
          flex item, just zero-height — cannot contribute a second row gap
          between the summary row and the buy row. */}
      <div className={styles.picker}>
        <button
          type="button"
          className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          {/* Swatch dots let the closed row say which colour is picked without
              spending a line on the word for it. */}
          <span className={styles.triggerSwatches} aria-hidden="true">
            {attributes.map((attr) => {
              const picked = attr.options.find((o) => o.key === sel[attr.id]);
              if (!picked || attr.displayType !== "swatch") return null;
              const isImage = picked.swatchType === "image" && !!picked.swatchUrl;
              if (!isImage && !picked.swatchValue) return null;
              return (
                <span
                  key={attr.id}
                  className={styles.triggerSwatch}
                  style={isImage ? { backgroundImage: `url(${picked.swatchUrl})` } : { background: picked.swatchValue! }}
                />
              );
            })}
          </span>
          <span className={styles.triggerText}>
            <span className={styles.triggerLabel}>{t.shop.optionsLabel}</span>
            <span className={styles.triggerValue}>{comboLabel}</span>
          </span>
          <ChevronDown size={14} strokeWidth={2.25} className={styles.chevron} aria-hidden="true" />
        </button>

        {/* grid-template-rows 0fr -> 1fr animates to the content's natural
            height: no measuring, and no max-height guess to outgrow. `inert`
            keeps the collapsed options out of the tab order. */}
        <div id={panelId} className={`${styles.panel} ${open ? styles.panelOpen : ""}`} inert={open ? undefined : true}>
          <div className={styles.panelInner}>
            {attributes.map((attr) => {
              const asDropdown = attr.displayType === "dropdown" || attr.options.length > MAX_INLINE_OPTIONS;
              const selected = attr.options.find((o) => o.key === sel[attr.id]);

              return (
                <div key={attr.id} className={styles.group}>
                  <span className={styles.groupLabel}>
                    {attr.name}
                    {selected && <span className={styles.groupValue}>{optionLabel(selected)}</span>}
                  </span>

                  {asDropdown ? (
                    <select className={styles.select} value={sel[attr.id] ?? ""} onChange={(e) => pick(attr.id, e.target.value)} aria-label={attr.name}>
                      <option value="" disabled>
                        {t.shop.selectPrefix} {attr.name}
                      </option>
                      {attr.options.map((o) => {
                        const state = optionState(attr.id, o.key);
                        return (
                          <option key={o.key} value={o.key} disabled={state === "unavailable"}>
                            {optionLabel(o)}
                            {state === "oos" ? ` (${t.shop.stockOutOfStock})` : ""}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <div className={styles.options}>
                      {attr.options.map((o) => {
                        const state = optionState(attr.id, o.key);
                        const isSwatch = attr.displayType === "swatch";
                        const isImage = o.swatchType === "image" && !!o.swatchUrl;
                        const cls = [
                          isSwatch ? styles.swatch : styles.chip,
                          state === "selected" ? styles.optionSelected : "",
                          state === "oos" ? styles.optionOos : "",
                          state === "unavailable" ? styles.optionUnavailable : "",
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <button
                            key={o.key}
                            type="button"
                            className={cls}
                            onClick={() => pick(attr.id, o.key)}
                            disabled={state === "unavailable"}
                            aria-pressed={state === "selected"}
                            title={optionLabel(o)}
                            aria-label={optionLabel(o)}
                          >
                            {isSwatch ? (
                              <span
                                className={styles.swatchInner}
                                style={isImage ? { backgroundImage: `url(${o.swatchUrl})` } : o.swatchValue ? { background: o.swatchValue } : undefined}
                              >
                                {!isImage && !o.swatchValue ? optionLabel(o).slice(0, 2) : null}
                              </span>
                            ) : (
                              optionLabel(o)
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
        </div>
      </div>

      {!variant ? (
        // Every attribute has a value from the first render, so this is the
        // rare combination the admin never built — the product page is the
        // only place that can explain what is available.
        <Link href={href} className={styles.detailsBtn}>
          {t.shop.seeDetails}
        </Link>
      ) : soldOut ? (
        <span className={styles.soldOut}>{t.shop.selectedOptionOutOfStock}</span>
      ) : (
        <div className={styles.buyRow}>
          {!inCart && (
            <div className={styles.qty}>
              <button type="button" className={styles.qtyBtn} onClick={() => setQty(Math.max(1, qtyToAdd - 1))} disabled={qtyToAdd <= 1} aria-label={t.shop.decreaseQty}>
                −
              </button>
              {/* The label is the whole point of the control: it reads as
                  "4 × Black / M", so what lands in the cart is unambiguous. */}
              <span className={styles.qtyValue} aria-live="polite">
                {qtyToAdd}
                <span className={styles.qtyCombo}>× {comboLabel}</span>
              </span>
              <button type="button" className={styles.qtyBtn} onClick={() => setQty(Math.min(maxQty, qtyToAdd + 1))} disabled={qtyToAdd >= maxQty} aria-label={t.shop.increaseQty}>
                +
              </button>
            </div>
          )}
          <AddToCartButton key={variant.id} variantId={variant.id} initialQty={qtyToAdd} selectedOptionValueIds={selectedOptionValueIds} size="sm" />
        </div>
      )}
    </div>
  );
}
