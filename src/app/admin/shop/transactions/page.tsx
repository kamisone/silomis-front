"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface Transaction {
  id: string;
  orderId: string;
  provider: string;
  providerTransactionId: string;
  type: "charge" | "refund" | "partial_refund";
  status: "pending" | "succeeded" | "failed" | "cancelled";
  amountCents: number;
  currency: string;
  createdAt: string;
}

function eur(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency });
}

const STATUS_BADGE: Record<Transaction["status"], string> = {
  succeeded: "badgeActive",
  pending: "badge",
  failed: "badgeInactive",
  cancelled: "badgeInactive",
};

export default function TransactionsPage() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      const data = await api.get<{ items: Transaction[]; total: number }>(`/next-api/admin/shop/transactions?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status]);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Transactions {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
      </div>

      <div className={ui.toolbar}>
        <select className={ui.select} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="charge">Charge</option>
          <option value="refund">Refund</option>
          <option value="partial_refund">Partial refund</option>
        </select>
        <select className={ui.select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="succeeded">Succeeded</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No transactions yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Provider ref</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/admin/shop/orders/${t.orderId}`} style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                      View order
                    </Link>
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{t.providerTransactionId}</td>
                  <td>{t.type.replace(/_/g, " ")}</td>
                  <td>{eur(t.amountCents, t.currency)}</td>
                  <td>
                    <span className={ui[STATUS_BADGE[t.status]]}>{t.status}</span>
                  </td>
                  <td>{new Date(t.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
