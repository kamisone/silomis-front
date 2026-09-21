"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { getTranslations, toBcp47 } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import EmbroideryLine, { slipLines, type EmbroideryLineDesign } from "@/components/shop/EmbroideryLine";
import SendInTracking, { type SendInTrackingData } from "@/components/shop/SendInTracking";
import OrderConversation from "@/components/shop/OrderConversation";
import styles from "../track.module.css";

interface TrackingItem {
  title: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  options: Array<{ attributeName: string; value: string }> | null;
  personalizations?: EmbroideryLineDesign[];
}

interface ShippingInfo {
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  estimatedDeliveryAt: string | null;
}

interface TimelineEntry {
  status: string;
  date: string;
  note: string | null;
}

interface OrderTracking {
  /** What this visitor proved. `full` (an emailed link) opens the conversation;
   *  `status` (order number + email) shows the order only. */
  accessLevel: "status" | "full";
  orderNumber: string;
  status: string;
  customerName: string | null;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  createdAt: string;
  items: TrackingItem[];
  shipping: ShippingInfo | null;
  timeline: TimelineEntry[];
  /** Present when this order is embroidery on the customer's own item. */
  sendIn?: SendInTrackingData | null;
}

const STATUS_ORDER = ["paid", "processing", "shipped", "delivered"] as const;

function centsToEuros(c: number) {
  return (c / 100).toFixed(2);
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "paid":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "processing":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "shipped":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case "delivered":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        </svg>
      );
  }
}

export default function OrderTrackDetailPage() {
  const locale = useLocale();
  const t = getTranslations(locale);
  const bcp47 = toBcp47(locale);
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<OrderTracking | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"order" | "messages">("order");
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Read before the tab is opened — a badge nobody can see until they click
  // the thing it is pointing at would be pointless. The endpoint answers 404
  // for a visitor without a grant, which simply leaves the count at zero.
  useEffect(() => {
    let active = true;
    fetch(`/next-api/public/shop/orders/${encodeURIComponent(orderNumber)}/conversation`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { unreadGuestCount?: number } | null) => {
        if (active) setUnreadMessages(d?.unreadGuestCount ?? 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [orderNumber]);

  // Only ever arrives from a link in an order email. `email` is still read
  // because links sent before the grant cookie existed carry it.
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // A credential in the URL is spent once, for a cookie, and then wiped
      // from the address bar with replaceState — no history entry, nothing
      // for a `Referer` header or a replay recording to carry away. After
      // this the grant cookie alone answers every reload.
      if (token || email) {
        await fetch(`/next-api/public/shop/orders/${encodeURIComponent(orderNumber)}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(token ? { token } : { email }),
        }).catch(() => undefined);
        window.history.replaceState(null, "", window.location.pathname);
      }

      const res = await fetch(
        `/next-api/public/shop/orders/${encodeURIComponent(orderNumber)}/track?lang=${locale}`,
      ).catch(() => null);

      if (cancelled) return;
      if (!res?.ok) {
        setError(true);
        setLoading(false);
        return;
      }
      setOrder((await res.json()) as OrderTracking);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderNumber, token, email, locale]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p style={{ textAlign: "center", padding: 40 }}>{t.shop.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.error}>{t.shop.orderNotFoundDetail}</p>
          <Link href={`/${locale}/shop/orders/track`} className={styles.backLink}>
            {t.shop.trackAnotherOrder}
          </Link>
        </div>
      </div>
    );
  }

  const TIMELINE_LABELS: Record<string, string> = {
    paid: t.shop.trackTimelinePaid,
    processing: t.shop.trackTimelinePreparing,
    shipped: t.shop.trackTimelineShipped,
    delivered: t.shop.trackTimelineDelivered,
  };

  const currentIdx = STATUS_ORDER.indexOf(order.status as (typeof STATUS_ORDER)[number]);

  const stepDateMap = new Map<string, string>();
  for (const entry of order.timeline) {
    if (!stepDateMap.has(entry.status)) stepDateMap.set(entry.status, entry.date);
  }

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      <Link href={`/${locale}/shop/orders/track`} className={styles.backLink}>
        ← {t.shop.trackAnotherOrder}
      </Link>

      {/* Header */}
      <div className={styles.trackHeader}>
        <div>
          <h1 className={styles.trackTitle}>{order.orderNumber}</h1>
          <p className={styles.trackDate}>
            {t.shop.placedOn} {new Date(order.createdAt).toLocaleDateString(bcp47, { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <span className={`${styles.statusBadge} ${styles[`status_${order.status}`] ?? ""}`}>{t.shop.orderStatusLabels[order.status as keyof typeof t.shop.orderStatusLabels] ?? order.status}</span>
      </div>

      {/* Two views of the same order, not two pages: the URL, the grant cookie
          and the loaded order are shared, so switching is instant and a
          customer never has to find their way back. */}
      <div className={styles.tabs} role="tablist" aria-label={order.orderNumber}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "order"}
          className={`${styles.tab} ${tab === "order" ? styles.tabActive : ""}`}
          onClick={() => setTab("order")}
        >
          {t.orderChat.tabOrder}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "messages"}
          className={`${styles.tab} ${tab === "messages" ? styles.tabActive : ""}`}
          onClick={() => {
            setTab("messages");
            // Opening the tab reads the thread, so the badge is spent.
            setUnreadMessages(0);
          }}
        >
          {t.orderChat.tabMessages}
          {unreadMessages > 0 && <span className={styles.tabBadge}>{unreadMessages}</span>}
        </button>
      </div>

      {/* Mounted but hidden rather than unmounted: the conversation keeps its
          socket, its scroll position and any half-typed message while the
          customer looks at the timeline and comes back. */}
      <div hidden={tab !== "messages"}>
        <OrderConversation orderNumber={order.orderNumber} locale={locale} active={tab === "messages"} />
      </div>

      <div hidden={tab !== "order"}>

      {/* Timeline — only meaningful once the order has been paid */}
      {currentIdx >= 0 && (
        <div className={styles.timeline}>
          {STATUS_ORDER.map((step, i) => {
            const done = currentIdx >= i;
            const active = currentIdx === i;
            return (
              <div key={step} className={`${styles.timelineStep} ${done ? styles.timelineStepDone : ""} ${active ? styles.timelineStepActive : ""}`}>
                <div className={styles.timelineDot}>
                  <StatusIcon status={step} />
                </div>
                <span className={styles.timelineLabel}>{TIMELINE_LABELS[step]}</span>
                {stepDateMap.has(step) && (
                  <span className={styles.timelineDate}>
                    {new Date(stepDateMap.get(step)!).toLocaleDateString(bcp47, { day: "numeric", month: "short" })}
                    {" · "}
                    {new Date(stepDateMap.get(step)!).toLocaleTimeString(bcp47, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {i < STATUS_ORDER.length - 1 && <div className={`${styles.timelineLine} ${currentIdx > i ? styles.timelineLineDone : ""}`} />}
              </div>
            );
          })}
        </div>
      )}

      {/* The customer's own item, when this order is one: where it is, and
          what the shop has shown them along the way. Above the shipping and
          items, because it is the thing they came to check. */}
      {order.sendIn && (
        <SendInTracking
          locale={locale}
          orderNumber={order.orderNumber}
          sendIn={order.sendIn}
          designLines={slipLines(order.items.flatMap((i) => i.personalizations ?? []))}
        />
      )}

      {/* Shipping info */}
      {order.shipping && (
        <div className={styles.infoCard}>
          <h3 className={styles.infoCardTitle}>{t.shop.trackShippingInfo}</h3>
          <div className={styles.infoGrid}>
            {order.shipping.carrier && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{t.shop.trackCarrier}</span>
                <span className={styles.infoValue}>{order.shipping.carrier}</span>
              </div>
            )}
            {order.shipping.trackingNumber && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{t.shop.trackTrackingNumber}</span>
                <span className={styles.infoValue}>
                  {order.shipping.trackingUrl ? (
                    <a href={order.shipping.trackingUrl} target="_blank" rel="noopener noreferrer" className={styles.trackingLink}>
                      {order.shipping.trackingNumber}
                    </a>
                  ) : (
                    order.shipping.trackingNumber
                  )}
                </span>
              </div>
            )}
            {order.shipping.estimatedDeliveryAt && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{t.shop.trackEstimatedDelivery}</span>
                <span className={styles.infoValue}>{new Date(order.shipping.estimatedDeliveryAt).toLocaleDateString(bcp47, { month: "long", day: "numeric" })}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      <div className={styles.infoCard}>
        <h3 className={styles.infoCardTitle}>{t.shop.trackOrderSummary}</h3>
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
      </div>
    </div>
  );
}
