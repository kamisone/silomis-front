"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
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

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  customerEmail: string;
  customerName: string | null;
  customerPhone: string | null;
  shippingAddressSnapshot: OrderAddress;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  trackingToken: string | null;
  createdAt: string;
  items: OrderItem[];
  statusHistory: StatusHistoryEntry[];
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
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      await api.patch(`/next-api/admin/shop/orders/${order.id}/status`, { status: toStatus });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Transition failed") : "Transition failed");
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
      {error && <p className={ui.error}>{error}</p>}

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
