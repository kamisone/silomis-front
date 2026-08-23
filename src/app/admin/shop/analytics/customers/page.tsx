"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface TopSpender {
  customerId: string;
  email: string;
  totalCents: number;
  orderCount: number;
}

interface CustomerInsights {
  totalCustomers: number;
  newCustomers: number;
  topSpenders: TopSpender[];
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

export default function CustomerInsightsPage() {
  const [data, setData] = useState<CustomerInsights | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<CustomerInsights>(`/next-api/admin/shop/analytics/customers?days=${days}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Customer Insights</h1>
        <select className={ui.select} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className={ui.kpiStrip} style={{ marginBottom: "1.5rem" }}>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Total customers</span>
          <span className={ui.kpiValue}>{loading ? "—" : data?.totalCustomers ?? 0}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>New customers ({days}d)</span>
          <span className={ui.kpiValue}>{loading ? "—" : data?.newCustomers ?? 0}</span>
        </div>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : (data?.topSpenders ?? []).length === 0 ? (
          <div className={ui.emptyState}>No data for this period.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Orders</th>
                <th>Total spent</th>
              </tr>
            </thead>
            <tbody>
              {(data?.topSpenders ?? []).map((s) => (
                <tr key={s.customerId}>
                  <td>{s.email}</td>
                  <td>{s.orderCount}</td>
                  <td>{eur(s.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
