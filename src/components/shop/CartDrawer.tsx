"use client";

import Link from "next/link";
import { useEffect, useCallback, useState, useRef } from "react";
import { useCart } from "./CartContext";
import { formatStockError } from "@/lib/shop/stockError";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./CartDrawer.module.css";

function centsToEuros(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function CartDrawer({ locale }: { locale: Locale }) {
  const t = getTranslations(locale);
  const { cart, isDrawerOpen, closeDrawer, updateItem, removeItem, mutating } = useCart();

  // Per-item qty state: pending display qty, error message, known stock cap
  const [pendingQtys, setPendingQtys] = useState<Record<string, number>>({});
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [itemMaxAvail, setItemMaxAvail] = useState<Record<string, number>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const handleQtyChange = useCallback(
    (itemId: string, displayQty: number, delta: 1 | -1) => {
      const next = displayQty + delta;

      if (next < 1) {
        setPendingQtys((prev) => {
          const n = { ...prev };
          delete n[itemId];
          return n;
        });
        if (debounceTimers.current[itemId]) clearTimeout(debounceTimers.current[itemId]);
        removeItem(itemId);
        return;
      }
      const knownMax = itemMaxAvail[itemId];
      if (delta === 1 && knownMax !== undefined && next > knownMax) return;

      setItemErrors((prev) => ({ ...prev, [itemId]: "" }));
      setPendingQtys((prev) => ({ ...prev, [itemId]: next }));

      if (debounceTimers.current[itemId]) clearTimeout(debounceTimers.current[itemId]);
      debounceTimers.current[itemId] = setTimeout(async () => {
        const result = await updateItem(itemId, next);
        setPendingQtys((prev) => {
          const n = { ...prev };
          delete n[itemId];
          return n;
        });
        if (result.ok) {
          setItemMaxAvail((prev) => {
            const n = { ...prev };
            delete n[itemId];
            return n;
          });
        } else {
          setItemErrors((prev) => ({ ...prev, [itemId]: formatStockError(result, t) }));
          if (typeof result.available === "number") {
            setItemMaxAvail((prev) => ({ ...prev, [itemId]: result.available! }));
            if (result.available > 0 && next > result.available) {
              setPendingQtys((prev) => ({ ...prev, [itemId]: result.available! }));
            }
          }
        }
      }, 350);
    },
    [updateItem, removeItem, itemMaxAvail, t],
  );

  // ESC key to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawerOpen) closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isDrawerOpen, closeDrawer]);

  // Prevent background scroll when open
  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) closeDrawer();
    },
    [closeDrawer],
  );

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className={`${styles.overlay} ${isDrawerOpen ? styles.open : ""}`} onClick={handleOverlayClick} aria-hidden={!isDrawerOpen}>
      <div className={styles.drawer} role="dialog" aria-modal="true" aria-label={t.shop.cartTitle}>
        {/* ── Header ── */}
        <div className={styles.drawerHead}>
          <div className={styles.titleRow}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span className={styles.drawerTitle}>{t.shop.cartTitle}</span>
            {!isEmpty && (
              <span className={styles.itemBadge}>
                {cart!.itemCount} {cart!.itemCount !== 1 ? t.shop.cartItemPlural : t.shop.cartItemSingular}
              </span>
            )}
          </div>
          <button onClick={closeDrawer} className={styles.closeBtn} aria-label={t.shop.closeCart}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Items ── */}
        <div className={styles.items}>
          {isEmpty ? (
            <div className={styles.empty}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.3 }}>
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <p className={styles.emptyTitle}>{t.shop.cartEmpty}</p>
              <p className={styles.emptySub}>{t.shop.cartEmptySub}</p>
              <Link href={`/${locale}/shop`} onClick={closeDrawer} className={styles.continueShoppingBtn}>
                {t.shop.continueShopping}
              </Link>
            </div>
          ) : (
            cart!.items.map((item) => (
              <div key={item.id} className={styles.item}>
                {/* Thumbnail */}
                <div className={styles.thumb}>
                  {item.imageUrl ? (
                    // Remote asset URLs (signed/CDN) aren't configured for next/image in this app — a plain <img> avoids that config dependency.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.titleSnapshot} />
                  ) : (
                    <div className={styles.thumbPlaceholder} />
                  )}
                </div>

                {/* Info + controls */}
                <div className={styles.itemBody}>
                  <div className={styles.itemTop}>
                    <div className={styles.itemInfo}>
                      <p className={styles.itemTitle}>{item.titleSnapshot}</p>
                      {item.optionsSnapshot && item.optionsSnapshot.length > 0 && (
                        <p className={styles.itemOptions}>{item.optionsSnapshot.map((o) => `${o.attributeName}: ${o.displayValue ?? o.value}`).join(" · ")}</p>
                      )}
                      {item.skuSnapshot && <p className={styles.itemSku}>{item.skuSnapshot}</p>}
                      <p className={styles.itemUnitPrice}>
                        €{centsToEuros(item.unitPriceCents)} {t.shop.unitPrice}
                      </p>
                    </div>
                    <button onClick={() => removeItem(item.id)} disabled={mutating} className={styles.removeBtn} aria-label={`${t.shop.removeItem} ${item.titleSnapshot}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>

                  {/* Qty stepper + line total */}
                  <div className={styles.itemBottom}>
                    <div className={styles.stepper}>
                      {(() => {
                        const dQty = pendingQtys[item.id] ?? item.quantity;
                        const atMax = itemMaxAvail[item.id] !== undefined && dQty >= itemMaxAvail[item.id];
                        return (
                          <>
                            <button onClick={() => handleQtyChange(item.id, dQty, -1)} disabled={mutating} className={styles.stepBtn} aria-label={t.shop.decreaseQty}>
                              −
                            </button>
                            <span className={styles.stepQty}>{dQty}</span>
                            <button onClick={() => handleQtyChange(item.id, dQty, 1)} disabled={mutating || atMax} className={styles.stepBtn} aria-label={t.shop.increaseQty}>
                              +
                            </button>
                          </>
                        );
                      })()}
                    </div>
                    <span className={styles.lineTotal}>€{centsToEuros(item.lineTotalCents)}</span>
                  </div>
                  {itemErrors[item.id] && <p className={styles.itemError}>{itemErrors[item.id]}</p>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Footer ── */}
        {!isEmpty && (
          <div className={styles.footer}>
            <div className={styles.subtotalRow}>
              <span className={styles.subtotalLabel}>{t.shop.drawerSubtotal}</span>
              <span className={styles.subtotalAmt}>€{centsToEuros(cart!.subtotalCents)}</span>
            </div>
            {cart!.freeShipping ? (
              <p className={styles.freeShippingNote}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="1" y="3" width="15" height="13" />
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                {t.shop.freeShippingCartNote}
              </p>
            ) : (
              <p className={styles.shippingNote}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="1" y="3" width="15" height="13" />
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                {t.shop.shippingCalcNote}
              </p>
            )}
            <Link href={`/${locale}/shop/checkout`} onClick={closeDrawer} className={styles.checkoutBtn}>
              {t.shop.checkoutCta} — €{centsToEuros(cart!.subtotalCents)}
            </Link>
            <Link href={`/${locale}/shop/cart`} onClick={closeDrawer} className={styles.viewCartBtn}>
              {t.shop.viewFullCart}
            </Link>
            <button onClick={closeDrawer} className={styles.continueBtn}>
              {t.shop.continueShopping}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
