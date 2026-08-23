"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

interface Overview {
  totalSubscribers: number;
  subscribedCount: number;
  sentEmails: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
}

interface Campaign {
  id: string;
  title: string;
  subject: string;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
}

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  cancelled: "Cancelled",
};

function badgeClass(status: CampaignStatus): string {
  if (status === "sent") return ui.badgeActive;
  if (status === "cancelled") return ui.badgeInactive;
  return ui.badge;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function NewslettersDashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<Overview>("/next-api/admin/newsletter/analytics/overview"), api.get<{ items: Campaign[] }>("/next-api/admin/newsletter/campaigns?limit=5")])
      .then(([ov, camp]) => {
        setOverview(ov);
        setCampaigns(Array.isArray(camp.items) ? camp.items : []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Newsletter &amp; Email Marketing</h1>
        <Link href="/admin/marketing/campaigns/new">
          <Button>New campaign</Button>
        </Link>
      </div>

      <div className={ui.kpiStrip} style={{ marginBottom: "1.5rem" }}>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Subscribers</span>
          <span className={ui.kpiValue}>{loading ? "—" : (overview?.subscribedCount ?? 0).toLocaleString()}</span>
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
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <Link href="/admin/marketing/campaigns">
          <Button variant="secondary">Campaigns</Button>
        </Link>
        <Link href="/admin/marketing/subscribers">
          <Button variant="secondary">Subscribers</Button>
        </Link>
        <Link href="/admin/marketing/analytics">
          <Button variant="secondary">Email Analytics</Button>
        </Link>
      </div>

      <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem" }}>Recent campaigns</h2>
      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className={ui.emptyState}>No campaigns yet — create your first one.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Scheduled / Sent</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.title}</td>
                  <td style={{ color: "var(--color-secondary)" }}>{c.subject}</td>
                  <td>
                    <span className={badgeClass(c.status)}>{STATUS_LABELS[c.status]}</span>
                  </td>
                  <td style={{ color: "var(--color-secondary)" }}>{c.sentAt ? new Date(c.sentAt).toLocaleString() : c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : "—"}</td>
                  <td>
                    <Link href={`/admin/marketing/campaigns/${c.id}`} style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                      {c.status === "draft" || c.status === "scheduled" ? "Edit" : "View"}
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
