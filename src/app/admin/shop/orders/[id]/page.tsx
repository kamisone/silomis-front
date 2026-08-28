"use client";

import { useEffect, useState, useCallback } from "react";
import { Copy, Check, Truck, Package, MapPin } from "lucide-react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface OrderItem {
  id: string;
  titleSnapshot: string;
  skuSnapshot: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.15rem 0.45rem",
        border: "1px solid var(--color-surface)",
        borderRadius: 6,
        background: "var(--color-surface)",
        font: "inherit",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "0.82rem",
        color: "var(--color-primary)",
        cursor: "pointer",
      }}
    >
      {value}
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{ minWidth: 130, fontSize: "0.8rem", color: "var(--color-secondary)" }}>{label}</span>
      <span style={{ fontSize: "0.9rem" }}>{children}</span>
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
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setOrder(await api.get<Order>(`/next-api/admin/shop/orders/${id}`));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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
          <span className={ui.badge} style={{ marginTop: "0.35rem", display: "inline-block" }}>
            {order.status.replace(/_/g, " ")}
          </span>
        </div>
        <div className={ui.rowActions}>
          {nextStatuses.map((s) => (
            <Button key={s} variant={s === "cancelled" || s === "refunded" ? "danger" : "secondary"} disabled={transitioning} onClick={() => handleTransition(s)}>
              {STATUS_LABEL[s] ?? s}
            </Button>
          ))}
        </div>
      </div>

      <div className={ui.card} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <strong style={{ color: "var(--color-primary)" }}>Customer</strong>
        <div>{order.customerName ?? "—"}</div>
        <div style={{ color: "var(--color-secondary)", fontSize: "0.9rem" }}>{order.customerEmail}</div>
        {order.customerPhone && <div style={{ color: "var(--color-secondary)", fontSize: "0.9rem" }}>{order.customerPhone}</div>}
      </div>

      <div className={ui.card} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <strong style={{ color: "var(--color-primary)" }}>Shipping address</strong>
        <div>{addr.name}</div>
        <div>{addr.line1}</div>
        {addr.line2 && <div>{addr.line2}</div>}
        <div>
          {addr.zip} {addr.city}
        </div>
        <div>{addr.country}</div>
      </div>

      {/* Fulfilment — everything needed to book the label by hand, since
          shipment creation is deliberately manual. */}
      <div className={ui.card} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <strong style={{ color: "var(--color-primary)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <Truck size={16} aria-hidden="true" /> Shipping
        </strong>

        {order.shippingMethod ? (
          <>
            <Row label="Method">
              {order.shippingMethod.name}
              {order.shippingMethod.requiresPickupPoint && <span className={ui.badge} style={{ marginLeft: "0.4rem" }}>pickup point</span>}
            </Row>
            {order.shippingMethod.carrier && <Row label="Carrier">{order.shippingMethod.carrier}</Row>}
            {order.shippingMethod.carrierCode && (
              <Row label="Carrier code">
                <CopyValue value={order.shippingMethod.carrierCode} label="carrier code" />
              </Row>
            )}
            <Row label="Delivery estimate">
              {order.shippingMethod.estimatedDaysMin}–{order.shippingMethod.estimatedDaysMax} business days
            </Row>
          </>
        ) : (
          <Row label="Method">
            <span style={{ color: "var(--color-secondary)" }}>{order.shippingCents === 0 ? "Free shipping" : "No method recorded"}</span>
          </Row>
        )}
        <Row label="Shipping paid">{order.shippingCents === 0 ? "Free" : eur(order.shippingCents)}</Row>
        <Row label="Destination">
          {addr.zip} {addr.city}, {addr.country}
        </Row>
      </div>

      {order.pickupPointSnapshot && (
        <div className={ui.card} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <strong style={{ color: "var(--color-primary)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
            {order.pickupPointSnapshot.type === "locker" ? <Package size={16} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />}
            Pickup point
            <span className={ui.badge}>{order.pickupPointSnapshot.type === "locker" ? "locker" : "shop"}</span>
          </strong>

          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-secondary)" }}>
            Ship to this service point. The reference below is what the carrier needs — copy it rather than retyping.
          </p>

          <Row label="Service point ID">
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
            <div style={{ marginTop: "0.35rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>Opening hours</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))", gap: "0.15rem 1rem", marginTop: "0.3rem" }}>
                {order.pickupPointSnapshot.openingHours.map((day) => (
                  <div key={day.weekday} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                    <span style={{ color: "var(--color-secondary)" }}>{WEEKDAYS[day.weekday - 1]}</span>
                    <span>{day.slots.length ? day.slots.join(" · ") : "Closed"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                <td>{i.titleSnapshot}</td>
                <td>{i.skuSnapshot ?? "—"}</td>
                <td>{i.quantity}</td>
                <td>{eur(i.unitPriceCents)}</td>
                <td>{eur(i.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.3rem", borderTop: "1px solid var(--color-surface)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
            <span style={{ color: "var(--color-secondary)" }}>Subtotal</span>
            <span>{eur(order.subtotalCents)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
            <span style={{ color: "var(--color-secondary)" }}>Shipping</span>
            <span>{eur(order.shippingCents)}</span>
          </div>
          {order.discountCents > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
              <span style={{ color: "var(--color-secondary)" }}>Discount</span>
              <span>-{eur(order.discountCents)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total</span>
            <span>{eur(order.totalCents)}</span>
          </div>
        </div>
      </div>

      <div className={ui.card} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <strong style={{ color: "var(--color-primary)" }}>Status history</strong>
        {order.statusHistory.map((h) => (
          <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", borderBottom: "1px solid var(--color-surface)", paddingBottom: "0.5rem" }}>
            <div>
              <strong>{h.toStatus.replace(/_/g, " ")}</strong>
              {h.note && <span style={{ color: "var(--color-secondary)" }}> — {h.note}</span>}
            </div>
            <span style={{ color: "var(--color-secondary)" }}>{new Date(h.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
