"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface Transaction {
  id: string;
  orderId: string;
  provider: string;
  type: "charge" | "refund" | "partial_refund";
  status: "pending" | "succeeded" | "failed" | "cancelled";
  amountCents: number;
  currency: string;
  createdAt: string;
}

function eur(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency });
}

export default function RefundsPage() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ items: Transaction[]; total: number }>("/next-api/admin/shop/transactions?type=refund&limit=100")
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalRefunded = items.filter((t) => t.status === "succeeded").reduce((s, t) => s + t.amountCents, 0);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Refunds {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
      </div>

      <div className={ui.kpiStrip} style={{ marginBottom: "1.5rem" }}>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Total refunded</span>
          <span className={ui.kpiValue}>{loading ? "—" : eur(totalRefunded, items[0]?.currency ?? "EUR")}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Refund count</span>
          <span className={ui.kpiValue}>{loading ? "—" : total}</span>
        </div>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No refunds yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Type</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.createdAt).toLocaleString()}</td>
                  <td>
                    <Link href={`/admin/shop/orders/${t.orderId}`} style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                      View order
                    </Link>
                  </td>
                  <td>{t.type.replace(/_/g, " ")}</td>
                  <td>
                    <span className={t.status === "succeeded" ? ui.badgeActive : ui.badgeInactive}>{t.status}</span>
                  </td>
                  <td>{eur(t.amountCents, t.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
