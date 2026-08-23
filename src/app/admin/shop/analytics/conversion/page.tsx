"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface Funnel {
  days: number;
  views: number;
  addsToCart: number;
  checkoutsStarted: number;
  purchases: number;
  overallConversionRatePct: number;
}

interface ProductConversion {
  productId: string;
  title: string;
  slug: string;
  views: number;
  addsToCart: number;
  purchases: number;
  conversionRatePct: number;
}

interface CountryBreakdown {
  countryCode: string;
  countryName: string;
  views: number;
  addsToCart: number;
  purchases: number;
}

const FUNNEL_STEPS: Array<{ key: keyof Funnel; label: string }> = [
  { key: "views", label: "Product views" },
  { key: "addsToCart", label: "Added to cart" },
  { key: "checkoutsStarted", label: "Reached checkout" },
  { key: "purchases", label: "Purchased" },
];

export default function ConversionAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [products, setProducts] = useState<ProductConversion[]>([]);
  const [countries, setCountries] = useState<CountryBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<Funnel>(`/next-api/admin/shop/analytics/conversion-funnel?days=${days}`),
      api.get<ProductConversion[]>(`/next-api/admin/shop/analytics/conversion-by-product?days=${days}&limit=20`),
      api.get<CountryBreakdown[]>(`/next-api/admin/shop/analytics/country-breakdown?days=${days}&limit=20`),
    ])
      .then(([funnelData, productData, countryData]) => {
        setFunnel(funnelData);
        setProducts(Array.isArray(productData) ? productData : []);
        setCountries(Array.isArray(countryData) ? countryData : []);
      })
      .finally(() => setLoading(false));
  }, [days]);

  const maxCount = funnel ? Math.max(funnel.views, 1) : 1;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Conversion Metrics</h1>
        <select className={ui.select} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className={ui.kpiStrip} style={{ marginBottom: "1.5rem" }}>
        {loading || !funnel ? (
          <span className={ui.kpiValue}>—</span>
        ) : (
          <>
            <div className={ui.kpiCard}>
              <span className={ui.kpiLabel}>Product views</span>
              <span className={ui.kpiValue}>{funnel.views}</span>
            </div>
            <div className={ui.kpiCard}>
              <span className={ui.kpiLabel}>Added to cart</span>
              <span className={ui.kpiValue}>{funnel.addsToCart}</span>
            </div>
            <div className={ui.kpiCard}>
              <span className={ui.kpiLabel}>Reached checkout</span>
              <span className={ui.kpiValue}>{funnel.checkoutsStarted}</span>
            </div>
            <div className={ui.kpiCard}>
              <span className={ui.kpiLabel}>Purchases</span>
              <span className={ui.kpiValue}>{funnel.purchases}</span>
            </div>
            <div className={ui.kpiCard}>
              <span className={ui.kpiLabel}>Overall conversion</span>
              <span className={ui.kpiValue}>{funnel.overallConversionRatePct}%</span>
            </div>
          </>
        )}
      </div>

      {!loading && funnel && (
        <div className={ui.card} style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.85rem" }}>Funnel — last {funnel.days} days</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {FUNNEL_STEPS.map((step, i) => {
              const count = funnel[step.key] as number;
              const widthPct = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 2 : 0) : 0;
              const prevCount = i > 0 ? (funnel[FUNNEL_STEPS[i - 1].key] as number) : null;
              const stepRatePct = prevCount ? Math.round((count / prevCount) * 1000) / 10 : null;
              return (
                <div key={step.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{step.label}</span>
                    <span style={{ color: "var(--color-secondary)" }}>
                      {count}
                      {stepRatePct !== null && <span style={{ marginLeft: 8 }}>({stepRatePct}% of previous step)</span>}
                    </span>
                  </div>
                  <div style={{ background: "var(--color-surface-tint)", borderRadius: 6, height: 18, overflow: "hidden" }}>
                    <div style={{ width: `${widthPct}%`, background: "var(--color-primary)", height: "100%", borderRadius: 6, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem" }}>Conversion by product</h2>
      <div className={ui.card} style={{ marginBottom: "1.5rem" }}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : products.length === 0 ? (
          <div className={ui.emptyState}>No product activity for this period.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Views</th>
                <th>Added to cart</th>
                <th>Purchases</th>
                <th>Conversion rate</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.productId}>
                  <td style={{ fontWeight: 600 }}>{p.title}</td>
                  <td>{p.views}</td>
                  <td>{p.addsToCart}</td>
                  <td>{p.purchases}</td>
                  <td>{p.conversionRatePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem" }}>By country</h2>
      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : countries.length === 0 ? (
          <div className={ui.emptyState}>No country data for this period.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Country</th>
                <th>Views</th>
                <th>Added to cart</th>
                <th>Purchases</th>
              </tr>
            </thead>
            <tbody>
              {countries.map((c) => (
                <tr key={c.countryCode}>
                  <td>
                    {c.countryName} <span style={{ color: "var(--color-secondary)", fontSize: "0.75rem" }}>({c.countryCode})</span>
                  </td>
                  <td>{c.views}</td>
                  <td>{c.addsToCart}</td>
                  <td>{c.purchases}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
