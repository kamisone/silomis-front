"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useVariantSelection, type SelectableVariant, type VariantSelection } from "./useVariantSelection";

interface CardVariantValue {
  selection: VariantSelection;
  /**
   * The image the current selection points at, or null to leave the card's
   * own gallery alone. Picking "Black" swaps the card to the black photo.
   */
  activeImageUrl: string | null;
}

/**
 * Null for a product with no variations — most cards on most storefronts —
 * so ProductCardMedia and the buy box both stay usable without a provider.
 */
const CardVariantContext = createContext<CardVariantValue | null>(null);

export function useCardVariant(): CardVariantValue | null {
  return useContext(CardVariantContext);
}

/** A variant carrying the extra fields a card needs beyond the picker's own. */
export interface CardVariant extends SelectableVariant {
  /** The variant's own photo, when the admin has attached one. */
  featuredMediaUrl?: string | null;
}

/**
 * Owns variation selection for one product card.
 *
 * A provider rather than state inside the buy box: the picked option has to
 * reach the image (a colour swap) and the buy box (price, stock, the variant
 * to add), which are siblings. Server-rendered children — the title, the
 * price, the badges — pass straight through, so wrapping the card in this does
 * not turn the grid into client-rendered markup.
 */
export function CardVariantProvider({ variants, children }: { variants: CardVariant[]; children: ReactNode }) {
  const base = useVariantSelection(variants);
  const { sel, currentVariant } = base;

  // The picker starts pre-set to the default variant, so overriding on mount
  // would silently replace the card's hover gallery for every product whose
  // variants carry photos. The swap is a response to a click, so it waits for
  // one.
  const [touched, setTouched] = useState(false);
  const pick = useCallback(
    (attrId: string, key: string) => {
      setTouched(true);
      base.pick(attrId, key);
    },
    [base],
  );
  const selection = useMemo(() => ({ ...base, pick }), [base, pick]);

  // Which photo the card should show for the current pick — the same rule the
  // product page applies in activeHeroUrl, so a colour shows the same shot in
  // both places. The variant's own featured media wins; failing that an
  // "image"-type swatch stands in for it, which is the common case: the admin
  // attaches the photo to the option value ("Red"), not to every variant that
  // uses it, so a product with per-colour photos and no per-variant media
  // would otherwise never change picture.
  //
  // Image swatches are per-product, hence swatchUrl — swatchValue only ever
  // holds the global hex of a colour swatch.
  const activeImageUrl = useMemo(() => {
    if (!touched) return null;

    const resolved = currentVariant as CardVariant | null;
    if (resolved?.featuredMediaUrl) return resolved.featuredMediaUrl;

    for (const attr of base.attributes) {
      const picked = attr.options.find((o) => o.key === sel[attr.id]);
      if (picked?.swatchType === "image" && picked.swatchUrl) return picked.swatchUrl;
    }

    // Nothing resolved and no image swatch — a shopper who has picked a colour
    // but not a size should still see the colour, so fall back to the first
    // variant matching everything chosen so far that carries a photo.
    const picked = Object.entries(sel);
    if (!picked.length) return null;
    const match = (variants as CardVariant[]).find(
      (v) =>
        v.featuredMediaUrl &&
        picked.every(([attrId, key]) =>
          v.options.some((o) => o.attributeId === attrId && (o.optionValueId ?? `${o.attributeId}::${o.value}`) === key),
        ),
    );
    return match?.featuredMediaUrl ?? null;
  }, [touched, currentVariant, base.attributes, sel, variants]);

  const value = useMemo(() => ({ selection, activeImageUrl }), [selection, activeImageUrl]);

  return <CardVariantContext.Provider value={value}>{children}</CardVariantContext.Provider>;
}
