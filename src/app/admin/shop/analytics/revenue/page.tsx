"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface RevenuePoint {
  date: string;
  revenueCents: number;
  orders: number;
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

export default function RevenueAnalyticsPage() {
  const [days, setDays] = useState<7 | 30>(30);
  const [series, setSeries] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<RevenuePoint[]>(`/next-api/admin/shop/analytics/revenue-series?days=${days}`)
      .then((data) => setSeries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [days]);

  const totalRevenue = series.reduce((s, p) => s + p.revenueCents, 0);
  const totalOrders = series.reduce((s, p) => s + p.orders, 0);
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const maxRevenue = Math.max(...series.map((p) => p.revenueCents), 1);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Revenue Analytics</h1>
        <select className={ui.select} value={days} onChange={(e) => setDays(Number(e.target.value) === 7 ? 7 : 30)}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      <div className={ui.kpiStrip} style={{ marginBottom: "1.5rem" }}>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Total revenue</span>
          <span className={ui.kpiValue}>{loading ? "—" : eur(totalRevenue)}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Total orders</span>
          <span className={ui.kpiValue}>{loading ? "—" : totalOrders}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Avg order value</span>
          <span className={ui.kpiValue}>{loading ? "—" : eur(avgOrder)}</span>
        </div>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : series.length === 0 ? (
          <div className={ui.emptyState}>No revenue data for this period.</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 160, padding: "0 0 1rem" }}>
              {series.map((p) => (
                <div key={p.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
                  <div
                    style={{
                      width: "100%",
                      background: "var(--color-primary)",
                      borderRadius: 3,
                      height: `${(p.revenueCents / maxRevenue) * 130}px`,
                      minHeight: p.revenueCents > 0 ? 2 : 0,
                    }}
                    title={`${p.date}: ${eur(p.revenueCents)} (${p.orders} orders)`}
                  />
                </div>
              ))}
            </div>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Avg order</th>
                </tr>
              </thead>
              <tbody>
                {[...series].reverse().map((p) => (
                  <tr key={p.date}>
                    <td>{p.date}</td>
                    <td>{p.orders}</td>
                    <td>{eur(p.revenueCents)}</td>
                    <td>{p.orders > 0 ? eur(p.revenueCents / p.orders) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
