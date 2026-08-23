"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useCart } from "./CartContext";
import { formatStockError } from "@/lib/shop/stockError";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./AddToCartButton.module.css";

interface Props {
  variantId: string;
  initialQty?: number;
  size?: "sm" | "lg";
  className?: string;
  selectedOptionValueIds?: string[];
  disabled?: boolean;
  /** When set, renders a disabled button with this label instead of the normal add-to-cart UI. */
  blockedLabel?: string | null;
}

export default function AddToCartButton({ variantId, initialQty = 1, size = "lg", className, selectedOptionValueIds, disabled: externalDisabled, blockedLabel }: Props) {
  const locale = useLocale();
  const t = getTranslations(locale);
  const { cart, addItem, updateItem, removeItem, mutating, openDrawer } = useCart();
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [addError, setAddError] = useState("");

  // Stepper state (used when item is already in cart)
  const [pendingQty, setPendingQty] = useState<number | null>(null);
  const [stepperMax, setStepperMax] = useState<number | null>(null);
  const [stepperErr, setStepperErr] = useState("");
  const stepperTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cartItem = cart?.items.find((i) => i.variantId === variantId) ?? null;

  // Reset stepper state when the variant being viewed changes
  useEffect(() => {
    const t = setTimeout(() => {
      setPendingQty(null);
      setStepperMax(null);
      setStepperErr("");
      if (stepperTimer.current) clearTimeout(stepperTimer.current);
    }, 0);
    return () => clearTimeout(t);
  }, [variantId]);

  useEffect(() => {
    return () => {
      if (stepperTimer.current) clearTimeout(stepperTimer.current);
    };
  }, []);

  const handleAdd = useCallback(async () => {
    setAdding(true);
    setAddError("");
    const result = await addItem(variantId, initialQty, selectedOptionValueIds);
    setAdding(false);
    if (result.ok) {
      setJustAdded(true);
      openDrawer();
      setTimeout(() => setJustAdded(false), 2200);
    } else {
      setAddError(formatStockError(result, t));
    }
  }, [variantId, initialQty, selectedOptionValueIds, addItem, openDrawer, t]);

  const handleStepperChange = useCallback(
    (delta: 1 | -1) => {
      if (!cartItem) return;
      const base = pendingQty ?? cartItem.quantity;
      const next = base + delta;

      if (next < 1) {
        setPendingQty(null);
        if (stepperTimer.current) clearTimeout(stepperTimer.current);
        removeItem(cartItem.id);
        return;
      }
      if (delta === 1 && stepperMax !== null && next > stepperMax) return;

      setStepperErr("");
      setPendingQty(next);

      if (stepperTimer.current) clearTimeout(stepperTimer.current);
      const itemId = cartItem.id;
      stepperTimer.current = setTimeout(async () => {
        const result = await updateItem(itemId, next);
        setPendingQty(null);
        if (result.ok) {
          setStepperMax(null);
          setStepperErr("");
        } else {
          setStepperErr(formatStockError(result, t));
          if (typeof result.available === "number") {
            setStepperMax(result.available);
            if (result.available > 0 && next > result.available) setPendingQty(result.available);
          }
        }
      }, 350);
    },
    [cartItem, pendingQty, stepperMax, updateItem, removeItem, t],
  );

  if (blockedLabel) {
    return (
      <div className={`${styles.addWrap} ${className ?? ""}`}>
        <button disabled className={`${styles.addBtn} ${styles[size]}`} aria-label={blockedLabel}>
          {blockedLabel}
        </button>
      </div>
    );
  }

  if (cartItem) {
    const displayQty = pendingQty ?? cartItem.quantity;
    const atMax = stepperMax !== null && displayQty >= stepperMax;
    return (
      <div className={`${styles.addWrap} ${className ?? ""}`}>
        <div className={`${styles.stepper} ${styles[size]}`}>
          <button onClick={() => handleStepperChange(-1)} disabled={mutating} className={styles.stepBtn} aria-label={displayQty === 1 ? t.shop.removeFromCart : t.shop.decreaseQty}>
            {displayQty === 1 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            ) : (
              "−"
            )}
          </button>
          <span className={styles.qty}>{displayQty}</span>
          <button onClick={() => handleStepperChange(1)} disabled={mutating || atMax} className={styles.stepBtn} aria-label={t.shop.increaseQty}>
            +
          </button>
        </div>
        {stepperErr && <p className={styles.error}>{stepperErr}</p>}
      </div>
    );
  }

  return (
    <div className={`${styles.addWrap} ${className ?? ""}`}>
      <button onClick={handleAdd} disabled={adding || mutating || externalDisabled} className={`${styles.addBtn} ${styles[size]} ${justAdded ? styles.justAdded : ""}`} aria-label={t.shop.addToCart}>
        {adding ? (
          <span className={styles.addingLabel}>
            <span className={styles.spinner} aria-hidden="true" />
            {t.shop.adding}
          </span>
        ) : justAdded ? (
          <span className={styles.addedLabel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {t.shop.addedToCart}
          </span>
        ) : (
          t.shop.addToCart
        )}
      </button>
      {addError && <p className={styles.error}>{addError}</p>}
    </div>
  );
}
