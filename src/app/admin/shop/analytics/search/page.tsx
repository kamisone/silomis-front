"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface SearchOverview {
  totalSearches: number;
  zeroResultSearches: number;
  zeroResultRatePct: number;
}

interface SearchRow {
  query: string;
  count: number;
}

export default function SearchInsightsPage() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<SearchOverview | null>(null);
  const [topSearches, setTopSearches] = useState<SearchRow[]>([]);
  const [zeroResults, setZeroResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<SearchOverview>(`/next-api/admin/shop/analytics/search-overview?days=${days}`),
      api.get<SearchRow[]>(`/next-api/admin/shop/analytics/top-searches?days=${days}&limit=20`),
      api.get<SearchRow[]>(`/next-api/admin/shop/analytics/zero-result-searches?days=${days}&limit=20`),
    ])
      .then(([overviewData, topData, zeroData]) => {
        setOverview(overviewData);
        setTopSearches(Array.isArray(topData) ? topData : []);
        setZeroResults(Array.isArray(zeroData) ? zeroData : []);
      })
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Search Insights</h1>
        <select className={ui.select} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className={ui.kpiStrip} style={{ marginBottom: "1.5rem" }}>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Total searches</span>
          <span className={ui.kpiValue}>{loading || !overview ? "—" : overview.totalSearches}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Zero-result searches</span>
          <span className={ui.kpiValue}>{loading || !overview ? "—" : overview.zeroResultSearches}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Zero-result rate</span>
          <span className={ui.kpiValue}>{loading || !overview ? "—" : `${overview.zeroResultRatePct}%`}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div className={ui.card}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem" }}>Top searches</h2>
          {loading ? (
            <div className={ui.emptyState}>Loading…</div>
          ) : topSearches.length === 0 ? (
            <div className={ui.emptyState}>No searches for this period.</div>
          ) : (
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Searches</th>
                </tr>
              </thead>
              <tbody>
                {topSearches.map((r) => (
                  <tr key={r.query}>
                    <td>{r.query}</td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={ui.card}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
            Zero-result searches <span style={{ fontWeight: 400, fontSize: "0.8rem", color: "var(--color-secondary)" }}>— unmet catalog demand</span>
          </h2>
          {loading ? (
            <div className={ui.emptyState}>Loading…</div>
          ) : zeroResults.length === 0 ? (
            <div className={ui.emptyState}>No zero-result searches for this period.</div>
          ) : (
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Searches</th>
                </tr>
              </thead>
              <tbody>
                {zeroResults.map((r) => (
                  <tr key={r.query}>
                    <td>{r.query}</td>
                    <td>
                      <span className={ui.badgeInactive}>{r.count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
