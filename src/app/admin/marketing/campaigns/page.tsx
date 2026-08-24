"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

interface AudienceDefinition {
  segment: string;
  tags?: string[];
}

interface Campaign {
  id: string;
  title: string;
  subject: string;
  type: string;
  status: CampaignStatus;
  audience: AudienceDefinition;
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

const TYPE_LABELS: Record<string, string> = {
  newsletter: "Newsletter",
  promotion: "Promotion",
  new_arrivals: "New Arrivals",
  flash_sale: "Flash Sale",
  category: "Category",
  abandoned_cart: "Abandoned Cart",
  product_launch: "Product Launch",
  announcement: "Announcement",
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All subscribers",
  fr: "French speakers",
  en: "English speakers",
  customers: "Customers",
  non_customers: "Non-customers",
  purchasers: "Purchasers",
  newsletter_only: "Newsletter-only",
  tags: "Custom tags",
};

function audienceLabel(audience: AudienceDefinition): string {
  const label = AUDIENCE_LABELS[audience.segment] ?? audience.segment;
  return audience.segment === "tags" && audience.tags?.length ? `${label}: ${audience.tags.join(", ")}` : label;
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export default function CampaignsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const limit = 20;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: String(limit), offset: String((page - 1) * limit) });
      if (statusFilter) qs.set("status", statusFilter);
      if (typeFilter) qs.set("type", typeFilter);
      if (search) qs.set("search", search);
      const data = await api.get<{ items: Campaign[]; total: number }>(`/next-api/admin/newsletter/campaigns?${qs}`);
      setCampaigns(data.items);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const pages = Math.ceil(total / limit) || 1;

  function applyFilters() {
    setPage(1);
    load();
  }

  async function duplicateCampaign(id: string) {
    try {
      const data = await api.post<{ id: string }>(`/next-api/admin/newsletter/campaigns/${id}/duplicate`);
      toast.success("Campaign duplicated");
      router.push(`/admin/marketing/campaigns/${data.id}`);
    } catch (err) {
      toast.error(errMessage(err, "Duplicate failed"));
    }
  }

  async function cancelCampaign(id: string) {
    if (!confirm("Cancel this scheduled campaign?")) return;
    try {
      await api.post(`/next-api/admin/newsletter/campaigns/${id}/cancel`);
      toast.success("Campaign cancelled");
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Cancel failed"));
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Campaigns {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
        <Link href="/admin/marketing/campaigns/new">
          <Button>New campaign</Button>
        </Link>
      </div>

      <div className={ui.toolbar} style={{ marginBottom: "1rem" }}>
        <input
          className={ui.searchInput}
          placeholder="Search title or subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyFilters();
          }}
        />
        <select
          className={ui.select}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={ui.select}
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={applyFilters}>
          Filter
        </Button>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className={ui.emptyState}>No campaigns found.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Status</th>
                <th>Audience</th>
                <th>Scheduled / Sent</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.title}</td>
                  <td style={{ color: "var(--color-secondary)" }}>{c.subject}</td>
                  <td>{TYPE_LABELS[c.type] ?? c.type}</td>
                  <td>
                    <span className={badgeClass(c.status)}>{STATUS_LABELS[c.status]}</span>
                  </td>
                  <td style={{ color: "var(--color-secondary)" }}>{audienceLabel(c.audience)}</td>
                  <td style={{ color: "var(--color-secondary)" }}>{c.sentAt ? new Date(c.sentAt).toLocaleString() : c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : "—"}</td>
                  <td>
                    <div className={ui.rowActions}>
                      <Link href={`/admin/marketing/campaigns/${c.id}`}>
                        <Button variant="secondary">{c.status === "draft" || c.status === "scheduled" ? "Edit" : "View"}</Button>
                      </Link>
                      <Button variant="secondary" onClick={() => duplicateCampaign(c.id)}>
                        Duplicate
                      </Button>
                      {c.status === "scheduled" && (
                        <Button variant="danger" onClick={() => cancelCampaign(c.id)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && pages > 1 && (
        <div className={ui.toolbar} style={{ marginTop: "1rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>{total} campaigns</span>
          {Array.from({ length: pages }, (_, i) => (
            <Button key={i} variant={page === i + 1 ? "primary" : "secondary"} onClick={() => setPage(i + 1)}>
              {i + 1}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
