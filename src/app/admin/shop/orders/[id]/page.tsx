"use client";

import { useEffect, useState, useCallback } from "react";
import { Copy, Check, Truck, Package, MapPin, Scissors } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import AdminOrderConversation from "@/components/admin/orders/AdminOrderConversation";
import { EmbroideryJobCard, STATUS_LABEL as JOB_STATUS_LABEL, type EmbroideryJob } from "@/components/admin/shop/EmbroideryJob";
import { SendInJobPanel, type SendInJob } from "@/components/admin/shop/SendInJobPanel";
import ui from "@/components/admin/ui/admin-ui.module.css";
import s from "./OrderDetail.module.css";

interface OrderItem {
  id: string;
  titleSnapshot: string;
  skuSnapshot: string | null;
  optionsSnapshot: Array<{ attributeName: string; value: string; displayValue: string | null }> | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  /** Embroidery fee already folded into unitPriceCents; kept apart for the breakdown. */
  personalizationCents: number;
  personalizations: Array<{
    id: string;
    placementLabel: string;
    contentType: "text" | "monogram" | "motif";
    text: string;
    motifName: string | null;
    productionStatus: "pending" | "digitizing" | "ready" | "stitched";
  }>;
}

interface StatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
}

interface OrderAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  zip: string;
  country: string;
}

/** Carrier pickup point chosen at checkout — snapshotted, so it survives the point closing later. */
interface OrderPickupPoint {
  id: string;
  name: string;
  address: string;
  postcode: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  type: "relay" | "locker";
  carrierCode: string | null;
  openingHours: Array<{ weekday: number; slots: string[] }> | null;
  selectedAt: string;
}

/** The method the customer paid for — everything needed to book the label by hand. */
interface OrderShippingMethod {
  id: string;
  name: string;
  carrier: string | null;
  carrierCode: string | null;
  code: string | null;
  priceCents: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  requiresPickupPoint: boolean;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  customerEmail: string;
  customerName: string | null;
  customerPhone: string | null;
  shippingAddressSnapshot: OrderAddress;
  pickupPointSnapshot: OrderPickupPoint | null;
  shippingMethodId: string | null;
  shippingMethod: OrderShippingMethod | null;
  customerLocale: string | null;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  trackingToken: string | null;
  createdAt: string;
  items: OrderItem[];
  statusHistory: StatusHistoryEntry[];
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Copies a value the admin has to retype into the carrier's own dashboard.
 * Fulfilment is manual, so the service-point reference is transcribed by hand —
 * one click removes the most likely way to ship a parcel to the wrong shop.
 */
function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      className={s.copy}
    >
      {value}
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      <span className={s.rowValue}>{children}</span>
    </div>
  );
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

// Mirrors OrdersService's ALLOWED_TRANSITIONS state machine — keeps the
// admin from offering a transition the backend would reject.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["awaiting_payment", "cancelled"],
  pending: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["paid", "cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  awaiting_payment: "Awaiting payment",
  paid: "Mark as paid",
  processing: "Start processing",
  shipped: "Mark as shipped",
  delivered: "Mark as delivered",
  cancelled: "Cancel order",
  refunded: "Refund order",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [jobs, setJobs] = useState<EmbroideryJob[]>([]);
  const [sendIn, setSendIn] = useState<SendInJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [tab, setTab] = useState<"order" | "messages">("order");
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Loading is only the first read; a reload after a status change keeps the
  // page in place rather than blanking it.
  const load = useCallback(async () => {
    try {
      let loaded = await api.get<Order>(`/next-api/admin/shop/orders/${id}`);
      // An order still waiting on its payment is checked against Stripe as it
      // is opened: if the money is there and the webhook never said so, the
      // order is settled now — so what the desk reads is what Stripe holds.
      if (loaded.status === "awaiting_payment" || loaded.status === "draft") {
        const res = await api.post<{ status: string | null; reconciled: boolean }>(`/next-api/admin/shop/transactions/${id}/reconcile`, {}).catch(() => null);
        if (res?.reconciled) {
          toast.success("Stripe confirmed this payment — the order is now paid.");
          loaded = await api.get<Order>(`/next-api/admin/shop/orders/${id}`);
        }
      }
      setOrder(loaded);
      // The production view of the same designs — status, note, stitch file,
      // artwork. Fetched only when the order actually carries embroidery.
      if (loaded.items.some((i) => i.personalizations?.length)) {
        const [res, job] = await Promise.all([
          api.get<{ items: EmbroideryJob[] }>(`/next-api/admin/shop/personalization/orders/${id}/jobs`),
          // Null unless this order is embroidery on the customer's own item.
          api.get<SendInJob | null>(`/next-api/admin/shop/send-in/order/${id}`),
        ]);
        setJobs(res.items);
        setSendIn(job);
      } else {
        setJobs([]);
        setSendIn(null);
      }
    } catch {
      setLoadError("Could not load this order.");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  /** A saved job card replaces its row, and the item table's badge follows. */
  const onJobChange = useCallback((job: EmbroideryJob) => {
    setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
    setOrder((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) => ({
              ...i,
              personalizations: i.personalizations?.map((d) => (d.id === job.id ? { ...d, productionStatus: job.productionStatus } : d)),
            })),
          }
        : prev,
    );
  }, []);

  useEffect(() => {
    // Deferred a tick: the read is a network round-trip, not a synchronous
    // state update, and the lint rule cannot tell the difference otherwise.
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // The unread count has to be known before the Messages tab is opened — that
  // is the whole point of a badge — so it is read here rather than inside the
  // conversation component, which only mounts once the tab is chosen.
  useEffect(() => {
    if (!id) return;
    let active = true;
    const t = setTimeout(() => {
      fetch(`/next-api/support/admin/orders/${encodeURIComponent(id)}/conversation`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { unreadAdminCount?: number } | null) => {
          if (active) setUnreadMessages(d?.unreadAdminCount ?? 0);
        })
        .catch(() => {});
    }, 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [id]);

  async function handleTransition(toStatus: string) {
    if (!order) return;
    if ((toStatus === "cancelled" || toStatus === "refunded") && !confirm(`${STATUS_LABEL[toStatus]}? This cannot be undone.`)) return;
    setTransitioning(true);
    try {
      await api.patch(`/next-api/admin/shop/orders/${order.id}/status`, { status: toStatus });
      await load();
      toast.success(`Status updated to "${toStatus.replace(/_/g, " ")}"`);
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to update order status") : "Failed to update order status");
    } finally {
      setTransitioning(false);
    }
  }

  if (loadError) {
    return <p className={ui.error}>{loadError}</p>;
  }
  if (loading || !order) {
    return <div className={ui.emptyState}>Loading…</div>;
  }

  const nextStatuses = ALLOWED_TRANSITIONS[order.status] ?? [];
  const addr = order.shippingAddressSnapshot;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.pageTitle}>{order.orderNumber}</h1>
          <div className={s.headerMeta}>
            <span className={ui.badge}>{order.status.replace(/_/g, " ")}</span>
            <span className={s.headerDate}>Placed {new Date(order.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div className={ui.rowActions}>
          {(order.status === "awaiting_payment" || order.status === "draft") && (
            <Button
              variant="secondary"
              disabled={transitioning}
              onClick={() => {
                setTransitioning(true);
                api
                  .post<{ status: string | null; reconciled: boolean }>(`/next-api/admin/shop/transactions/${id}/reconcile`, {})
                  .then((res) => {
                    if (res.status === "paid") toast.success("Stripe confirmed the payment — the order is paid.");
                    else toast.info("Stripe has no successful payment for this order yet.");
                    return load();
                  })
                  .catch(() => toast.error("Could not check with Stripe."))
                  .finally(() => setTransitioning(false));
              }}
            >
              Check payment with Stripe
            </Button>
          )}
          {nextStatuses.map((s) => (
            <Button key={s} variant={s === "cancelled" || s === "refunded" ? "danger" : "secondary"} disabled={transitioning} onClick={() => handleTransition(s)}>
              {STATUS_LABEL[s] ?? s}
            </Button>
          ))}
        </div>
      </div>

      {/* The customer's tracking page has the same two tabs. Keeping the pair
          symmetrical means a reply written here lands where they are looking. */}
      <div className={ui.tabs} role="tablist" aria-label={order.orderNumber}>
        <button type="button" role="tab" aria-selected={tab === "order"} className={`${ui.tab} ${tab === "order" ? ui.tabActive : ""}`} onClick={() => setTab("order")}>
          Order
        </button>
        <button type="button" role="tab" aria-selected={tab === "messages"} className={`${ui.tab} ${tab === "messages" ? ui.tabActive : ""}`} onClick={() => setTab("messages")}>
          Messages
          {unreadMessages > 0 && (
            <span className={`${ui.badgeAlert} ${s.tabBadge}`}>{unreadMessages}</span>
          )}
        </button>
      </div>

      {/* Mounted only while open: this one holds a socket, and every order page
          left in a background tab would otherwise keep one alive. */}
      {tab === "messages" && (
        <AdminOrderConversation
          orderId={order.id}
          orderNumber={order.orderNumber}
          // Opening the tab reads the thread, so the count it reported is
          // spent — the badge clears rather than sitting there contradicting
          // the messages on screen.
          onUnread={setUnreadMessages}
        />
      )}

      <div hidden={tab !== "order"} className={s.grid}>
        {/* Left: what was bought and what has to be made. */}
        <div className={s.main}>
          <div className={ui.card}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div className={s.itemCell}>
                        <span>{i.titleSnapshot}</span>
                        {i.optionsSnapshot && i.optionsSnapshot.length > 0 && (
                          <span className={s.itemOptions}>
                            {i.optionsSnapshot.map((o) => `${o.attributeName}: ${o.displayValue ?? o.value}`).join(" · ")}
                          </span>
                        )}
                        {/* One line per embroidered position: the words, and
                            where the floor has got to with them. The full job
                            cards sit below; this is the glance. */}
                        {i.personalizations?.map((d) => (
                          <a key={d.id} href={`#job-${d.id}`} className={s.itemJob}>
                            <Scissors size={12} aria-hidden="true" />
                            <span>
                              {d.placementLabel}:{" "}
                              <strong>{d.contentType === "motif" ? (d.motifName ?? "shape") : `“${d.text.replace(/\n/g, " / ")}”`}</strong>
                            </span>
                            <span className={ui.badge}>{JOB_STATUS_LABEL[d.productionStatus]}</span>
                          </a>
                        ))}
                      </div>
                    </td>
                    <td>{i.skuSnapshot ?? "—"}</td>
                    <td>{i.quantity}</td>
                    <td>
                      {eur(i.unitPriceCents)}
                      {i.personalizationCents > 0 && <span className={s.itemSub}>incl. {eur(i.personalizationCents)} embroidery</span>}
                    </td>
                    <td>{eur(i.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={s.totals}>
              <div className={s.totalRow}>
                <span className={s.totalLabel}>Subtotal</span>
                <span>{eur(order.subtotalCents)}</span>
              </div>
              <div className={s.totalRow}>
                <span className={s.totalLabel}>Shipping</span>
                <span>{eur(order.shippingCents)}</span>
              </div>
              {order.discountCents > 0 && (
                <div className={s.totalRow}>
                  <span className={s.totalLabel}>Discount</span>
                  <span>-{eur(order.discountCents)}</span>
                </div>
              )}
              <div className={`${s.totalRow} ${s.totalFinal}`}>
                <span>Total</span>
                <span>{eur(order.totalCents)}</span>
              </div>
            </div>
          </div>

          {/* The customer's own item, when this order is one: their photo and
              note, and the round trip the desk moves it through. Above the
              embroidery jobs, because nothing can be stitched before it
              arrives. */}
          {sendIn && (
            <section aria-label="Customer's own item">
              <SendInJobPanel job={sendIn} onChange={setSendIn} showOrder={false} />
            </section>
          )}

          {jobs.length > 0 && (
            <section aria-labelledby="embroidery-heading" className={s.section}>
              <div className={s.sectionHead}>
                <div>
                  <h2 id="embroidery-heading" className={s.sectionTitle}>
                    <Scissors size={16} aria-hidden="true" /> Embroidery — {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
                  </h2>
                  <p className={s.panelNote}>Each position is hooped and run on its own. Everything below was frozen when the customer paid.</p>
                </div>
                <Link href="/admin/shop/personalization" className={s.sectionLink}>
                  Open the production queue →
                </Link>
              </div>
              <div className={s.jobGrid}>
                {jobs.map((job) => (
                  <div key={job.id} id={`job-${job.id}`}>
                    <EmbroideryJobCard job={job} onChange={onJobChange} showOrder={false} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right: the reference the desk copies from while working — who,
            where, how it ships, and what has happened so far. */}
        <div className={s.aside}>
          <div className={`${ui.card} ${s.panel}`}>
            <h2 className={s.panelTitle}>Customer</h2>
            <div className={s.lines}>
              <span className={s.lineStrong}>{order.customerName ?? "—"}</span>
              <span className={s.lineMuted}>{order.customerEmail}</span>
              {order.customerPhone && <span className={s.lineMuted}>{order.customerPhone}</span>}
            </div>
          </div>

          <div className={`${ui.card} ${s.panel}`}>
            <h2 className={s.panelTitle}>Shipping address</h2>
            <div className={s.lines}>
              <span className={s.lineStrong}>{addr.name}</span>
              <span>{addr.line1}</span>
              {addr.line2 && <span>{addr.line2}</span>}
              <span>
                {addr.zip} {addr.city}
              </span>
              <span>{addr.country}</span>
            </div>
          </div>

          {/* Fulfilment — everything needed to book the label by hand, since
              shipment creation is deliberately manual. */}
          <div className={`${ui.card} ${s.panel}`}>
            <h2 className={s.panelTitle}>
              <Truck size={14} aria-hidden="true" /> Shipping
            </h2>
            {order.shippingMethod ? (
              <>
                <Row label="Method">
                  {order.shippingMethod.name}
                  {order.shippingMethod.requiresPickupPoint && <span className={ui.badge}>pickup point</span>}
                </Row>
                {order.shippingMethod.carrier && <Row label="Carrier">{order.shippingMethod.carrier}</Row>}
                {order.shippingMethod.carrierCode && (
                  <Row label="Carrier code">
                    <CopyValue value={order.shippingMethod.carrierCode} label="carrier code" />
                  </Row>
                )}
                <Row label="Estimate">
                  {order.shippingMethod.estimatedDaysMin}–{order.shippingMethod.estimatedDaysMax} business days
                </Row>
              </>
            ) : (
              <Row label="Method">
                <span className={s.lineMuted}>{order.shippingCents === 0 ? "Free shipping" : "No method recorded"}</span>
              </Row>
            )}
            <Row label="Paid">{order.shippingCents === 0 ? "Free" : eur(order.shippingCents)}</Row>
            <Row label="Destination">
              {addr.zip} {addr.city}, {addr.country}
            </Row>
          </div>

          {order.pickupPointSnapshot && (
            <div className={`${ui.card} ${s.panel}`}>
              <h2 className={s.panelTitle}>
                {order.pickupPointSnapshot.type === "locker" ? <Package size={14} aria-hidden="true" /> : <MapPin size={14} aria-hidden="true" />}
                Pickup point
                <span className={ui.badge}>{order.pickupPointSnapshot.type === "locker" ? "locker" : "shop"}</span>
              </h2>
              <p className={s.panelNote}>Ship to this service point. The reference below is what the carrier needs — copy it rather than retyping.</p>

              <Row label="Point ID">
                <CopyValue value={order.pickupPointSnapshot.id} label="service point ID" />
              </Row>
              <Row label="Name">{order.pickupPointSnapshot.name}</Row>
              <Row label="Address">
                {order.pickupPointSnapshot.address}
                <br />
                {order.pickupPointSnapshot.postcode} {order.pickupPointSnapshot.city}, {order.pickupPointSnapshot.country}
              </Row>
              {order.pickupPointSnapshot.carrierCode && <Row label="Network">{order.pickupPointSnapshot.carrierCode}</Row>}
              {order.pickupPointSnapshot.latitude !== null && order.pickupPointSnapshot.longitude !== null && (
                <Row label="Coordinates">
                  <CopyValue value={`${order.pickupPointSnapshot.latitude}, ${order.pickupPointSnapshot.longitude}`} label="coordinates" />
                </Row>
              )}
              <Row label="Chosen at">{new Date(order.pickupPointSnapshot.selectedAt).toLocaleString()}</Row>

              {order.pickupPointSnapshot.openingHours && order.pickupPointSnapshot.openingHours.length > 0 && (
                <div>
                  <span className={s.lineMuted}>Opening hours</span>
                  <div className={s.hours}>
                    {order.pickupPointSnapshot.openingHours.map((day) => (
                      <div key={day.weekday} className={s.hoursRow}>
                        <span className={s.hoursDay}>{WEEKDAYS[day.weekday - 1]}</span>
                        <span>{day.slots.length ? day.slots.join(" · ") : "Closed"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={`${ui.card} ${s.panel}`}>
            <h2 className={s.panelTitle}>Status history</h2>
            <div className={s.history}>
              {order.statusHistory.map((h) => (
                <div key={h.id} className={s.historyRow}>
                  <div>
                    <strong className={s.historyStatus}>{h.toStatus.replace(/_/g, " ")}</strong>
                    {h.note && <span className={s.historyNote}> — {h.note}</span>}
                  </div>
                  {/* Date and time both: this is the audit trail for a
                      payment and a dispatch, and "which day" is rarely the
                      question being asked of it. */}
                  <span className={s.historyDate}>
                    {new Date(h.createdAt).toLocaleDateString()}
                    <br />
                    {new Date(h.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
