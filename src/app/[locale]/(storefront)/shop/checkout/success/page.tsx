"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/components/shop/CartContext";
import { getTranslations } from "@/lib/i18n";
import EmbroideryLine, { slipLines, type EmbroideryLineDesign } from "@/components/shop/EmbroideryLine";
import SendInTracking, { type SendInTrackingData } from "@/components/shop/SendInTracking";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./Success.module.css";

interface TrackingItem {
  title: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  options: Array<{ attributeName: string; value: string }> | null;
  personalizations?: EmbroideryLineDesign[];
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
  sendIn?: SendInTrackingData | null;
  /** False for a phone-only order: no email will follow this page. */
  hasEmail?: boolean;
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
  const [copied, setCopied] = useState(false);

  const orderNumber = searchParams.get("order");
  const token = searchParams.get("token");
  const orderId = searchParams.get("id");
  const clearedRef = useRef(false);
  const router = useRouter();
  // A redirect method (iDEAL, Bancontact, PayPal, Klarna…) always comes back
  // here, paid or not. `failed` means the customer backed out on the bank's
  // page or was declined there: nothing was charged and the order is still
  // open, so they go straight back to the payment step — basket untouched —
  // rather than to a "thank you" for an order they did not pay for.
  const paymentFailed = searchParams.get("redirect_status") === "failed";

  useEffect(() => {
    if (paymentFailed) router.replace(`/${locale}/shop/checkout?payment=failed`);
  }, [paymentFailed, router, locale]);

  useEffect(() => {
    if (clearedRef.current || paymentFailed) return;
    clearedRef.current = true;
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paymentFailed) return;
    if (!orderNumber) {
      const t = setTimeout(() => {
        setLoading(false);
        setError(true);
      }, 0);
      return () => clearTimeout(t);
    }
    const qs = new URLSearchParams();
    if (token) qs.set("token", token);
    // Product and position names come back in this language, whatever
    // language the basket was in when the order was placed.
    qs.set("lang", locale);

    // Stripe sends the customer back here before its webhook has necessarily
    // reached the shop. Settling from Stripe's own answer first means the
    // page they land on says "paid", not "awaiting payment" — and that the
    // confirmation email and the desk's alert go out now rather than never,
    // should the webhook not be configured for this environment.
    const reconcile = orderId
      ? fetch(`/next-api/public/shop/payment/${encodeURIComponent(orderId)}/reconcile`, { method: "POST" }).catch(() => undefined)
      : Promise.resolve(undefined);

    reconcile
      .then(() => fetch(`/next-api/public/shop/orders/${encodeURIComponent(orderNumber)}/track?${qs.toString()}`))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setOrder(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [orderNumber, token, orderId, locale, paymentFailed]);

  if (loading || paymentFailed) {
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
          <Link href={`/${locale}`} className={styles.backLink}>
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

        {/* A phone-only order gets no confirmation email, so this page is the
            receipt: say that updates come by SMS, and hand over the tracking
            link — it carries the token, so it opens the order on any device. */}
        {order.hasEmail === false && token && (
          <div className={styles.sendInNext}>
            <strong>{t.shop.successNoEmailTitle}</strong>
            <p>{t.shop.successNoEmailBody}</p>
            <button
              type="button"
              className={styles.copyLinkBtn}
              onClick={() => {
                const url = `${window.location.origin}/${locale}/shop/orders/track/${order.orderNumber}?token=${token}`;
                navigator.clipboard?.writeText(url).then(
                  () => setCopied(true),
                  () => undefined,
                );
              }}
            >
              {copied ? t.shop.trackingLinkCopied : t.shop.copyTrackingLink}
            </button>
          </div>
        )}

        {/* A send-in order is not finished at payment: the item still has to
            be posted. Said here, first, with the address and the note to
            print. This page gets bookmarked and reopened, so once the parcel
            is in the "post it to us" box is gone and the round trip shows
            in full — the shop's photos included — as the tracking page does. */}
        {order.sendIn && (
          <>
            {order.sendIn.status === "awaiting_item" && (
              <div className={styles.sendInNext}>
                <strong>{t.sendIn.successTitle}</strong>
                <p>{t.sendIn.successBody}</p>
              </div>
            )}
            <SendInTracking
              locale={locale}
              orderNumber={order.orderNumber}
              sendIn={order.sendIn}
              designLines={slipLines(order.items.flatMap((i) => i.personalizations ?? []))}
              compact={order.sendIn.status === "awaiting_item"}
            />
          </>
        )}

        <div className={styles.infoCard}>
          <h3 className={styles.infoCardTitle}>{t.shop.checkoutOrderSummary}</h3>
          <div className={styles.itemsList}>
            {order.items.map((item, i) => (
              <div key={i} className={styles.itemRow}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  {item.options && item.options.length > 0 && <span className={styles.itemOptions}>{item.options.map((o) => `${o.attributeName}: ${o.value}`).join(" · ")}</span>}
                  {item.personalizations?.map((d) => (
                    <EmbroideryLine key={d.placementKey} design={d} locale={locale} />
                  ))}
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
        <Link href={`/${locale}`} className={styles.backLink}>
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
