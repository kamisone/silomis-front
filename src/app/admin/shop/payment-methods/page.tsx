"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface PaymentMethod {
  id: string;
  customerId: string;
  provider: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  isDefault: boolean;
  status: "active" | "expired" | "detached";
  createdAt: string;
  paymentType: { name: string } | null;
}

export default function PaymentMethodsPage() {
  const [items, setItems] = useState<PaymentMethod[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (status) params.set("status", status);
      const res = await api.get<{ items: PaymentMethod[]; total: number }>(`/next-api/admin/shop/payment-methods?${params.toString()}`);
      setItems(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleRemove(m: PaymentMethod) {
    if (!confirm("Remove this saved payment method?")) return;
    try {
      await api.delete(`/next-api/admin/shop/payment-methods/${m.id}`);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Remove failed") : "Remove failed");
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Saved payment methods {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)", marginTop: "-0.5rem" }}>
        Read-only browse — there is no in-app flow to save a card yet, so this table stays empty until that&apos;s built.
      </p>

      <div className={ui.toolbar}>
        <select className={ui.select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="detached">Detached</option>
        </select>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No saved payment methods.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Card</th>
                <th>Type</th>
                <th>Expires</th>
                <th>Default</th>
                <th>Status</th>
                <th>Saved</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.cardBrand ?? m.provider} •••• {m.cardLast4 ?? "----"}
                  </td>
                  <td>{m.paymentType?.name ?? "—"}</td>
                  <td>{m.cardExpMonth && m.cardExpYear ? `${String(m.cardExpMonth).padStart(2, "0")}/${m.cardExpYear}` : "—"}</td>
                  <td>{m.isDefault ? "Yes" : "—"}</td>
                  <td>
                    <span className={m.status === "active" ? ui.badgeActive : ui.badgeInactive}>{m.status}</span>
                  </td>
                  <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Button variant="danger" onClick={() => handleRemove(m)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
