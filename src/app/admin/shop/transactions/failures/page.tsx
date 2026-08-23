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
  amountCents: number;
  currency: string;
  createdAt: string;
}

function eur(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency });
}

export default function PaymentFailuresPage() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ items: Transaction[]; total: number }>("/next-api/admin/shop/transactions?status=failed&limit=100")
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Payment Failures {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No payment failures recorded.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Provider</th>
                <th>Type</th>
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
                  <td>{t.provider}</td>
                  <td>{t.type.replace(/_/g, " ")}</td>
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
