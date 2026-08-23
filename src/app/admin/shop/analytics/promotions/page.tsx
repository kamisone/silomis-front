"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface PromoPerf {
  code: string;
  name: string;
  usesCount: number;
  discountCents: number;
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

export default function DiscountAnalyticsPage() {
  const [items, setItems] = useState<PromoPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<7 | 30>(30);

  useEffect(() => {
    setLoading(true);
    api
      .get<PromoPerf[]>(`/next-api/admin/shop/analytics/promotions?days=${days}`)
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [days]);

  const totalUses = useMemo(() => items.reduce((s, p) => s + p.usesCount, 0), [items]);
  const totalDiscount = useMemo(() => items.reduce((s, p) => s + p.discountCents, 0), [items]);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Discount Analytics</h1>
        <select className={ui.select} value={days} onChange={(e) => setDays(Number(e.target.value) === 7 ? 7 : 30)}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      <div className={ui.kpiStrip} style={{ marginBottom: "1.5rem" }}>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Coupon uses</span>
          <span className={ui.kpiValue}>{loading ? "—" : totalUses}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Total discount given</span>
          <span className={ui.kpiValue}>{loading ? "—" : eur(totalDiscount)}</span>
        </div>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No coupon redemptions in this window.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Uses</th>
                <th>Discount given</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.code}>
                  <td>
                    <span className={ui.codeChip} style={{ marginLeft: 0 }}>
                      {p.code}
                    </span>
                  </td>
                  <td>{p.name}</td>
                  <td>{p.usesCount}</td>
                  <td>{eur(p.discountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
