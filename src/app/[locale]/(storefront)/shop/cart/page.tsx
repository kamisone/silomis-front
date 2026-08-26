"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "@/components/shop/CartContext";
import PriceBreakdown from "@/components/shop/PriceBreakdown";
import { formatStockError } from "@/lib/shop/stockError";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./Cart.module.css";

function centsToEuros(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function CartPage() {
  const locale = useLocale();
  const t = getTranslations(locale);
  const { cart, updateItem, removeItem, loading, mutating } = useCart();

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

  if (loading && !cart) {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>{t.shop.cartPageTitle}</h1>
        <p className={styles.loadingNote}>{t.shop.loading}</p>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconBadge}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <h2 className={styles.emptyTitle}>{t.shop.cartEmpty}</h2>
          <p className={styles.emptySub}>{t.shop.cartEmptyBrowse}</p>
          <Link href={`/${locale}`} className={styles.emptyCta}>
            {t.shop.browseProducts}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{t.shop.cartPageTitle}</h1>
      <div className={styles.layout}>
        <div className={styles.items}>
          {cart.items.map((item) => {
            const productHref = item.productSlug ? `/${locale}/shop/${item.productSlug}` : null;
            const dQty = pendingQtys[item.id] ?? item.quantity;
            const atMax = itemMaxAvail[item.id] !== undefined && dQty >= itemMaxAvail[item.id];
            return (
              <div key={item.id} className={styles.item}>
                {productHref ? (
                  <Link href={productHref} className={styles.itemImage}>
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.titleSnapshot} />
                    ) : (
                      <div className={styles.imagePlaceholder} />
                    )}
                  </Link>
                ) : (
                  <div className={styles.itemImage}>
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.titleSnapshot} />
                    ) : (
                      <div className={styles.imagePlaceholder} />
                    )}
                  </div>
                )}
                <div className={styles.itemDetails}>
                  {productHref ? (
                    <Link href={productHref} className={styles.itemTitleLink}>
                      <p className={styles.itemTitle}>{item.titleSnapshot}</p>
                    </Link>
                  ) : (
                    <p className={styles.itemTitle}>{item.titleSnapshot}</p>
                  )}
                  {item.optionsSnapshot && item.optionsSnapshot.length > 0 && (
                    <p className={styles.itemOptions}>{item.optionsSnapshot.map((o) => `${o.attributeName}: ${o.displayValue ?? o.value}`).join(" · ")}</p>
                  )}
                  <p className={styles.itemPrice}>€{centsToEuros(item.unitPriceCents)}</p>
                </div>
                <div className={styles.itemQtyCol}>
                  <div className={styles.itemQty}>
                    <button onClick={() => handleQtyChange(item.id, dQty, -1)} disabled={mutating} aria-label={t.shop.decreaseQty}>
                      −
                    </button>
                    <span>{dQty}</span>
                    <button onClick={() => handleQtyChange(item.id, dQty, 1)} disabled={mutating || atMax} aria-label={t.shop.increaseQty}>
                      +
                    </button>
                  </div>
                  {itemErrors[item.id] && <p className={styles.itemQtyError}>{itemErrors[item.id]}</p>}
                </div>
                <div className={styles.itemTotal}>€{centsToEuros(item.lineTotalCents)}</div>
                <button onClick={() => removeItem(item.id)} className={styles.removeBtn} disabled={mutating} aria-label={`${t.shop.removeItem} ${item.titleSnapshot}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.summary}>
          <h3>{t.shop.orderSummary}</h3>

          <PriceBreakdown locale={locale} subtotalCents={cart.subtotalCents} freeShipping={cart.freeShipping} totalCents={cart.subtotalCents} />

          {cart.freeShipping && (
            <p className={styles.freeShippingNote}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 7h11v8H3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M14 10h3.5L21 13v2h-7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <circle cx="7" cy="17.5" r="1.8" stroke="currentColor" strokeWidth="1.7" />
                <circle cx="17" cy="17.5" r="1.8" stroke="currentColor" strokeWidth="1.7" />
              </svg>
              {t.shop.freeShippingCartNote}
            </p>
          )}

          <Link href={`/${locale}/shop/checkout`} className={styles.checkoutBtn}>
            {t.shop.proceedToCheckout}
          </Link>
          <Link href={`/${locale}`} className={styles.continueLink}>
            {t.shop.continueShopping}
          </Link>
        </div>
      </div>
    </div>
  );
}
