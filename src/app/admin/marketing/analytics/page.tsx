"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface Overview {
  totalSubscribers: number;
  subscribedCount: number;
  unsubscribedCount: number;
  bouncedCount: number;
  sentEmails: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  bounceRate: number;
}

interface GrowthPoint {
  date: string;
  newSubscribers: number;
  totalSubscribers: number;
}

interface CampaignPerformanceRow {
  id: string;
  title: string;
  sentAt: string | null;
  recipients: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  openRate: number;
  clickRate: number;
}

const DAY_OPTIONS = [7, 30, 90];

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function MarketingAnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignPerformanceRow[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get<Overview>("/next-api/admin/newsletter/analytics/overview"), api.get<GrowthPoint[]>(`/next-api/admin/newsletter/analytics/growth?days=${days}`), api.get<CampaignPerformanceRow[]>("/next-api/admin/newsletter/analytics/campaigns?limit=10")])
      .then(([ov, gr, camp]) => {
        setOverview(ov);
        setGrowth(Array.isArray(gr) ? gr : []);
        setCampaigns(Array.isArray(camp) ? camp : []);
      })
      .finally(() => setLoading(false));
  }, [days]);

  const maxGrowth = Math.max(...growth.map((p) => p.newSubscribers), 1);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Email Analytics</h1>
      </div>

      <div className={ui.kpiStrip} style={{ marginBottom: "1.5rem" }}>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Total subscribers</span>
          <span className={ui.kpiValue}>{loading ? "—" : (overview?.totalSubscribers ?? 0).toLocaleString()}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Emails sent</span>
          <span className={ui.kpiValue}>{loading ? "—" : (overview?.sentEmails ?? 0).toLocaleString()}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Open rate</span>
          <span className={ui.kpiValue}>{loading ? "—" : pct(overview?.openRate ?? 0)}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Click rate</span>
          <span className={ui.kpiValue}>{loading ? "—" : pct(overview?.clickRate ?? 0)}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Unsubscribe rate</span>
          <span className={ui.kpiValue}>{loading ? "—" : pct(overview?.unsubscribeRate ?? 0)}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Bounce rate</span>
          <span className={ui.kpiValue}>{loading ? "—" : pct(overview?.bounceRate ?? 0)}</span>
        </div>
      </div>

      <div className={ui.card} style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>Subscriber growth</h2>
          <div className={ui.rowActions}>
            {DAY_OPTIONS.map((d) => (
              <Button key={d} variant={days === d ? "primary" : "secondary"} onClick={() => setDays(d)}>
                {d}d
              </Button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : growth.length === 0 ? (
          <div className={ui.emptyState}>No growth data for this period.</div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 120 }}>
            {growth.map((p) => (
              <div
                key={p.date}
                style={{ flex: 1, minWidth: 0, background: "var(--color-primary)", borderRadius: 2, height: `${(p.newSubscribers / maxGrowth) * 100}px`, minHeight: p.newSubscribers > 0 ? 2 : 0 }}
                title={`${p.date}: +${p.newSubscribers} (total ${p.totalSubscribers})`}
              />
            ))}
          </div>
        )}
      </div>

      <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem" }}>Campaign performance</h2>
      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className={ui.emptyState}>No sent campaigns yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Sent</th>
                <th>Recipients</th>
                <th>Opens</th>
                <th>Clicks</th>
                <th>Open rate</th>
                <th>Click rate</th>
                <th>Unsubscribes</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.title}</td>
                  <td style={{ color: "var(--color-secondary)" }}>{c.sentAt ? new Date(c.sentAt).toLocaleDateString() : "—"}</td>
                  <td>{c.recipients}</td>
                  <td>{c.opens}</td>
                  <td>{c.clicks}</td>
                  <td>{pct(c.openRate)}</td>
                  <td>{pct(c.clickRate)}</td>
                  <td>{c.unsubscribes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
