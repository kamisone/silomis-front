"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface BestSeller {
  productId: string;
  title: string;
  totalSold: number;
  revenueCents: number;
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

export default function ProductPerformancePage() {
  const [days, setDays] = useState<7 | 30>(30);
  const [sellers, setSellers] = useState<BestSeller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<BestSeller[]>(`/next-api/admin/shop/analytics/best-sellers?days=${days}&limit=50`)
      .then((data) => setSellers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [days]);

  const totalUnits = sellers.reduce((s, p) => s + p.totalSold, 0);
  const totalRevenue = sellers.reduce((s, p) => s + p.revenueCents, 0);
  const maxSold = Math.max(...sellers.map((p) => p.totalSold), 1);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Product Performance</h1>
        <select className={ui.select} value={days} onChange={(e) => setDays(Number(e.target.value) === 7 ? 7 : 30)}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      <div className={ui.kpiStrip} style={{ marginBottom: "1.5rem" }}>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Products ranked</span>
          <span className={ui.kpiValue}>{loading ? "—" : sellers.length}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Total units sold</span>
          <span className={ui.kpiValue}>{loading ? "—" : totalUnits}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Total revenue</span>
          <span className={ui.kpiValue}>{loading ? "—" : eur(totalRevenue)}</span>
        </div>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : sellers.length === 0 ? (
          <div className={ui.emptyState}>No sales data for this period.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Units sold</th>
                <th>Share</th>
                <th>Revenue</th>
                <th>Avg price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sellers.map((p, i) => (
                <tr key={p.productId}>
                  <td style={{ color: "var(--color-secondary)", width: 32 }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{p.title}</td>
                  <td>{p.totalSold}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ height: 6, width: 80, background: "var(--color-surface-tint)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(p.totalSold / maxSold) * 100}%`, background: "var(--color-primary)", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>{totalUnits > 0 ? Math.round((p.totalSold / totalUnits) * 100) : 0}%</span>
                    </div>
                  </td>
                  <td>{eur(p.revenueCents)}</td>
                  <td style={{ color: "var(--color-secondary)" }}>{p.totalSold > 0 ? eur(p.revenueCents / p.totalSold) : "—"}</td>
                  <td>
                    <Link href={`/admin/shop/products/${p.productId}`} style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                      View
                    </Link>
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
