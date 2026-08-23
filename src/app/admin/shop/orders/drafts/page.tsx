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

export default function DraftOrdersPage() {
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ items: OrderListItem[]; total: number }>("/next-api/admin/shop/orders?status=draft");
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Draft Orders {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No draft orders.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Created</th>
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
