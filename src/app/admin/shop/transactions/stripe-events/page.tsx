"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface StripeEventGroup {
  webhookEventId: string;
  orderId: string;
  status: string;
  count: number;
  createdAt: string;
}

export default function StripeEventsPage() {
  const [items, setItems] = useState<StripeEventGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ items: StripeEventGroup[] }>("/next-api/admin/shop/transactions/stripe-events?limit=100")
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Stripe Events {items.length > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({items.length})</span>}</h1>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No Stripe events recorded.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Order</th>
                <th>Status</th>
                <th>Transactions</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.webhookEventId}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{e.webhookEventId}</td>
                  <td>
                    <Link href={`/admin/shop/orders/${e.orderId}`} style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                      View order
                    </Link>
                  </td>
                  <td>
                    <span className={ui.badge}>{e.status}</span>
                  </td>
                  <td>{e.count}</td>
                  <td>{new Date(e.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
