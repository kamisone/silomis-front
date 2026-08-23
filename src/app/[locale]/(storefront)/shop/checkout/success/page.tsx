"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/shop/CartContext";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./Success.module.css";

interface TrackingItem {
  title: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  options: Array<{ attributeName: string; value: string }> | null;
}

interface OrderTracking {
  orderNumber: string;
  status: string;
  customerName: string | null;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  createdAt: string;
  items: TrackingItem[];
}

function centsToEuros(c: number) {
  return (c / 100).toFixed(2);
}

function SuccessContent() {
  const locale = useLocale();
  const t = getTranslations(locale);
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const [order, setOrder] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const orderNumber = searchParams.get("order");
  const token = searchParams.get("token");
  const clearedRef = useRef(false);

  useEffect(() => {
    if (clearedRef.current) return;
    clearedRef.current = true;
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!orderNumber) {
      const t = setTimeout(() => {
        setLoading(false);
        setError(true);
      }, 0);
      return () => clearTimeout(t);
    }
    const qs = new URLSearchParams();
    if (token) qs.set("token", token);

    fetch(`/next-api/public/shop/orders/${encodeURIComponent(orderNumber)}/track?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setOrder(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [orderNumber, token]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card} style={{ textAlign: "center", padding: 60 }}>
          {t.shop.loading}
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.errorMsg}>{t.shop.orderNotFoundConfirm}</p>
          <Link href={`/${locale}/shop`} className={styles.backLink}>
            {t.shop.backToShop}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className={styles.title}>{t.shop.thankYouOrderTitle}</h1>
        <p className={styles.subtitle}>
          {t.shop.orderPrefix} <strong>{order.orderNumber}</strong> {t.shop.orderConfirmedSuffix}
        </p>

        <div className={styles.infoCard}>
          <h3 className={styles.infoCardTitle}>{t.shop.checkoutOrderSummary}</h3>
          <div className={styles.itemsList}>
            {order.items.map((item, i) => (
              <div key={i} className={styles.itemRow}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  {item.options && item.options.length > 0 && <span className={styles.itemOptions}>{item.options.map((o) => `${o.attributeName}: ${o.value}`).join(" · ")}</span>}
                </div>
                <span className={styles.itemQty}>×{item.quantity}</span>
                <span className={styles.itemPrice}>€{centsToEuros(item.totalCents)}</span>
              </div>
            ))}
          </div>
          <div className={styles.totalSection}>
            <div className={styles.totalRow}>
              <span>{t.shop.subtotal}</span>
              <span>€{centsToEuros(order.subtotalCents)}</span>
            </div>
            {order.discountCents > 0 && (
              <div className={styles.totalRow}>
                <span>{t.shop.discount}</span>
                <span>-€{centsToEuros(order.discountCents)}</span>
              </div>
            )}
            <div className={styles.totalRow}>
              <span>{t.shop.shipping}</span>
              <span>{order.shippingCents === 0 ? t.shop.free : `€${centsToEuros(order.shippingCents)}`}</span>
            </div>
            <div className={`${styles.totalRow} ${styles.totalRowFinal}`}>
              <span>{t.shop.total}</span>
              <span>€{centsToEuros(order.totalCents)}</span>
            </div>
          </div>
        </div>

        <Link href={`/${locale}/shop/orders/track/${order.orderNumber}${token ? `?token=${token}` : ""}`} className={styles.trackLink}>
          {t.shop.trackThisOrder}
        </Link>
        <Link href={`/${locale}/shop`} className={styles.backLink}>
          {t.shop.continueShoppingCta}
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className={styles.page} />}>
      <SuccessContent />
    </Suspense>
  );
}
