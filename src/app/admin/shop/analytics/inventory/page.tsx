"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface LowStockItem {
  variantId: string;
  productId: string;
  available: number;
  lowStockThreshold: number;
}

interface InventoryData {
  totalItems: number;
  outOfStock: number;
  lowStock: number;
  lowStockItems: LowStockItem[];
}

export default function InventoryAnalyticsPage() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<InventoryData>("/next-api/admin/shop/analytics/inventory")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Inventory Analytics</h1>
      </div>

      <div className={ui.kpiStrip} style={{ marginBottom: "1.5rem" }}>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Total SKUs</span>
          <span className={ui.kpiValue}>{loading ? "—" : data?.totalItems ?? 0}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Out of stock</span>
          <span className={`${ui.kpiValue} ${ui.kpiDanger}`}>{loading ? "—" : data?.outOfStock ?? 0}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Low stock</span>
          <span className={`${ui.kpiValue} ${ui.kpiWarn}`}>{loading ? "—" : data?.lowStock ?? 0}</span>
        </div>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : (data?.lowStockItems ?? []).length === 0 ? (
          <div className={ui.emptyState}>No low-stock items.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Variant</th>
                <th>Available</th>
                <th>Threshold</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.lowStockItems ?? []).map((item) => (
                <tr key={item.variantId}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{item.variantId.slice(0, 8)}…</td>
                  <td style={{ fontWeight: 600 }}>{item.available}</td>
                  <td style={{ color: "var(--color-secondary)" }}>{item.lowStockThreshold}</td>
                  <td>
                    <span className={item.available === 0 ? ui.badgeInactive : ui.badge}>{item.available === 0 ? "Out of stock" : "Low stock"}</span>
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
