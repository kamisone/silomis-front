"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface Overview {
  totalOrders: number;
  totalRevenueCents: number;
  avgOrderCents: number;
  pendingOrders: number;
  processingOrders: number;
  computedAt: string | null;
}

interface RevenuePoint {
  date: string;
  revenueCents: number;
  orders: number;
}

interface BestSeller {
  productId: string;
  title: string;
  totalSold: number;
  revenueCents: number;
}

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

interface PromotionRow {
  code: string;
  name: string;
  usesCount: number;
  discountCents: number;
}

interface LowStockItem {
  variantId: string;
  productId: string;
  available: number;
  lowStockThreshold: number;
}

interface InventoryAnalytics {
  totalItems: number;
  outOfStock: number;
  lowStock: number;
  lowStockItems: LowStockItem[];
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

export default function ShopAnalyticsPage() {
  const [days, setDays] = useState<7 | 30>(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [series, setSeries] = useState<RevenuePoint[]>([]);
  const [bestSellers, setBestSellers] = useState<BestSeller[]>([]);
  const [customers, setCustomers] = useState<CustomerInsights | null>(null);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [inventory, setInventory] = useState<InventoryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [aggregating, setAggregating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, sr, bs, cu, pr, inv] = await Promise.all([
        api.get<Overview>(`/next-api/admin/shop/analytics/overview?days=${days}`),
        api.get<RevenuePoint[]>(`/next-api/admin/shop/analytics/revenue-series?days=${days}`),
        api.get<BestSeller[]>(`/next-api/admin/shop/analytics/best-sellers?days=${days}`),
        api.get<CustomerInsights>(`/next-api/admin/shop/analytics/customers?days=${days}`),
        api.get<PromotionRow[]>(`/next-api/admin/shop/analytics/promotions?days=${days}`),
        api.get<InventoryAnalytics>(`/next-api/admin/shop/analytics/inventory`),
      ]);
      setOverview(ov);
      setSeries(Array.isArray(sr) ? sr : []);
      setBestSellers(Array.isArray(bs) ? bs : []);
      setCustomers(cu);
      setPromotions(Array.isArray(pr) ? pr : []);
      setInventory(inv);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  async function rerunAggregation() {
    setAggregating(true);
    try {
      await api.post(`/next-api/admin/shop/analytics/aggregate`);
      await load();
    } finally {
      setAggregating(false);
    }
  }

  const maxRevenue = Math.max(...series.map((p) => p.revenueCents), 1);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Shop Analytics</h1>
        <div className={ui.toolbar}>
          <select className={ui.select} value={days} onChange={(e) => setDays(Number(e.target.value) === 7 ? 7 : 30)}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <Button variant="secondary" onClick={rerunAggregation} disabled={aggregating}>
            {aggregating ? "Re-running…" : "Re-run aggregation"}
          </Button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div className={ui.card} style={{ padding: "1rem 1.25rem", minWidth: 150 }}>
          <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>Revenue</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-primary)" }}>{overview ? eur(overview.totalRevenueCents) : "—"}</div>
        </div>
        <div className={ui.card} style={{ padding: "1rem 1.25rem", minWidth: 150 }}>
          <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>Orders</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-primary)" }}>{overview ? overview.totalOrders : "—"}</div>
        </div>
        <div className={ui.card} style={{ padding: "1rem 1.25rem", minWidth: 150 }}>
          <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>Avg. order</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-primary)" }}>{overview ? eur(overview.avgOrderCents) : "—"}</div>
        </div>
        <div className={ui.card} style={{ padding: "1rem 1.25rem", minWidth: 150 }}>
          <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>Pending payment</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-primary)" }}>{overview ? overview.pendingOrders : "—"}</div>
        </div>
        <div className={ui.card} style={{ padding: "1rem 1.25rem", minWidth: 150 }}>
          <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>Processing</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-primary)" }}>{overview ? overview.processingOrders : "—"}</div>
        </div>
      </div>

      {overview?.computedAt && (
        <div style={{ fontSize: "0.78rem", color: "var(--color-secondary)" }}>Last aggregated: {new Date(overview.computedAt).toLocaleString()}</div>
      )}

      <div className={ui.card} style={{ padding: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Revenue</h2>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : series.length === 0 ? (
          <div className={ui.emptyState}>No revenue in this period.</div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140 }}>
            {series.map((p) => (
              <div key={p.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <div
                  style={{
                    width: "100%",
                    background: "var(--color-accent)",
                    borderRadius: 3,
                    height: `${(p.revenueCents / maxRevenue) * 100}%`,
                    minHeight: 2,
                  }}
                  title={`${p.date}: ${eur(p.revenueCents)} (${p.orders} orders)`}
                />
                <span style={{ fontSize: 9, color: "var(--color-secondary)", whiteSpace: "nowrap" }}>{p.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={ui.card}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, padding: "1.25rem 1.25rem 0" }}>Best sellers</h2>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : bestSellers.length === 0 ? (
          <div className={ui.emptyState}>No sales in this period.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Units sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {bestSellers.map((b) => (
                <tr key={b.productId}>
                  <td>{b.title}</td>
                  <td>{b.totalSold}</td>
                  <td>{eur(b.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div className={ui.card} style={{ padding: "1rem 1.25rem", minWidth: 150 }}>
          <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>Total customers</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-primary)" }}>{customers ? customers.totalCustomers : "—"}</div>
        </div>
        <div className={ui.card} style={{ padding: "1rem 1.25rem", minWidth: 150 }}>
          <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>New customers</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-primary)" }}>{customers ? customers.newCustomers : "—"}</div>
        </div>
      </div>

      <div className={ui.card}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, padding: "1.25rem 1.25rem 0" }}>Top spenders</h2>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : !customers || customers.topSpenders.length === 0 ? (
          <div className={ui.emptyState}>No customers with paid orders yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Orders</th>
                <th>Total spent</th>
              </tr>
            </thead>
            <tbody>
              {customers.topSpenders.map((s) => (
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

      <div className={ui.card}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, padding: "1.25rem 1.25rem 0" }}>Promotion performance</h2>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : promotions.length === 0 ? (
          <div className={ui.emptyState}>No coupon usage in this period.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Uses (period)</th>
                <th>Discount given</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <tr key={p.code}>
                  <td>
                    <span className={ui.codeChip}>{p.code}</span>
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

      <div className={ui.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.25rem 0" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>Low stock</h2>
          {inventory && (
            <div style={{ fontSize: "0.78rem", color: "var(--color-secondary)" }}>
              {inventory.totalItems} variants · {inventory.outOfStock} out of stock · {inventory.lowStock} low stock
            </div>
          )}
        </div>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : !inventory || inventory.lowStockItems.length === 0 ? (
          <div className={ui.emptyState}>No variants are running low.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Variant</th>
                <th>Available</th>
                <th>Threshold</th>
              </tr>
            </thead>
            <tbody>
              {inventory.lowStockItems.map((i) => (
                <tr key={i.variantId}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{i.variantId.slice(0, 8)}…</td>
                  <td>{i.available}</td>
                  <td>{i.lowStockThreshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
