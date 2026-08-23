"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface OrderListItem {
  id: string;
  orderNumber: string;
  status: string;
  customerEmail: string;
  customerName: string | null;
  totalCents: number;
  createdAt: string;
  items: Array<{ quantity: number }>;
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

const STATUS_BADGE: Record<string, string> = {
  draft: "badge",
  pending: "badge",
  awaiting_payment: "badge",
  paid: "badgeActive",
  processing: "badgeActive",
  shipped: "badgeActive",
  delivered: "badgeActive",
  cancelled: "badgeInactive",
  refunded: "badgeInactive",
};

export default function OrdersListPage() {
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const data = await api.get<{ items: OrderListItem[]; total: number }>(`/next-api/admin/shop/orders?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Orders {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
      </div>

      <div className={ui.toolbar}>
        <input className={ui.searchInput} placeholder="Search by order #, name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={ui.select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="awaiting_payment">Awaiting payment</option>
          <option value="paid">Paid</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No orders yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/shop/orders/${o.id}`} style={{ fontWeight: 600, color: "var(--color-primary)" }}>
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td>
                    {o.customerName ?? "—"}
                    <div style={{ fontSize: "0.78rem", color: "var(--color-secondary)" }}>{o.customerEmail}</div>
                  </td>
                  <td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                  <td>{eur(o.totalCents)}</td>
                  <td>
                    <span className={ui[STATUS_BADGE[o.status] ?? "badge"]}>{o.status.replace(/_/g, " ")}</span>
                  </td>
                  <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
