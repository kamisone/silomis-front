"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

type SubscriberStatus = "subscribed" | "unsubscribed" | "bounced";

interface Subscriber {
  id: string;
  email: string;
  locale: string | null;
  status: SubscriberStatus;
  source: string | null;
  tags: string[];
  createdAt: string;
  lastActivityAt: string | null;
}

const STATUS_LABELS: Record<SubscriberStatus, string> = {
  subscribed: "Subscribed",
  unsubscribed: "Unsubscribed",
  bounced: "Bounced",
};

const BULK_ACTIONS = [
  { value: "unsubscribe", label: "Unsubscribe" },
  { value: "resubscribe", label: "Resubscribe" },
  { value: "add_tag", label: "Add tag" },
  { value: "remove_tag", label: "Remove tag" },
  { value: "delete", label: "Delete" },
];

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [localeFilter, setLocaleFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("unsubscribe");
  const [bulkTag, setBulkTag] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addLocale, setAddLocale] = useState("");
  const [addSource, setAddSource] = useState("");
  const [addTags, setAddTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: String(limit), offset: String((page - 1) * limit) });
      if (search) qs.set("search", search);
      if (statusFilter) qs.set("status", statusFilter);
      if (localeFilter) qs.set("locale", localeFilter);
      if (sourceFilter) qs.set("source", sourceFilter);
      if (tagFilter) qs.set("tag", tagFilter);
      const data = await api.get<{ items: Subscriber[]; total: number }>(`/next-api/admin/newsletter/subscribers?${qs}`);
      setSubscribers(data.items);
      setTotal(data.total);
    } catch (err) {
      setNotice({ text: errMessage(err, "Failed to load subscribers"), isError: true });
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
    setSelected(new Set());
    load();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === subscribers.length ? new Set() : new Set(subscribers.map((s) => s.id))));
  }

  async function runBulkAction() {
    if (selected.size === 0) return;
    if ((bulkAction === "add_tag" || bulkAction === "remove_tag") && !bulkTag.trim()) {
      setNotice({ text: "Enter a tag first", isError: true });
      return;
    }
    if (bulkAction === "delete" && !confirm(`Delete ${selected.size} subscriber(s)? This cannot be undone.`)) return;

    try {
      await api.post("/next-api/admin/newsletter/subscribers/bulk", {
        ids: Array.from(selected),
        action: bulkAction,
        ...(bulkAction === "add_tag" || bulkAction === "remove_tag" ? { tag: bulkTag.trim() } : {}),
      });
      setNotice({ text: "Bulk action applied", isError: false });
      setSelected(new Set());
      setBulkTag("");
      await load();
    } catch (err) {
      setNotice({ text: errMessage(err, "Bulk action failed"), isError: true });
    }
  }

  async function deleteOne(id: string) {
    if (!confirm("Delete this subscriber?")) return;
    try {
      await api.delete(`/next-api/admin/newsletter/subscribers/${id}`);
      setNotice({ text: "Subscriber deleted", isError: false });
      await load();
    } catch (err) {
      setNotice({ text: errMessage(err, "Delete failed"), isError: true });
    }
  }

  async function changeStatus(id: string, status: SubscriberStatus) {
    try {
      await api.patch(`/next-api/admin/newsletter/subscribers/${id}`, { status });
      setNotice({ text: "Subscriber updated", isError: false });
      await load();
    } catch (err) {
      setNotice({ text: errMessage(err, "Update failed"), isError: true });
    }
  }

  async function createSubscriber() {
    if (!addEmail.trim()) {
      setNotice({ text: "Email is required", isError: true });
      return;
    }
    setSaving(true);
    try {
      await api.post("/next-api/admin/newsletter/subscribers", {
        email: addEmail.trim(),
        locale: addLocale.trim() || undefined,
        source: addSource.trim() || undefined,
        tags: addTags.trim()
          ? addTags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      });
      setNotice({ text: "Subscriber added", isError: false });
      setAddOpen(false);
      setAddEmail("");
      setAddLocale("");
      setAddSource("");
      setAddTags("");
      setPage(1);
      await load();
    } catch (err) {
      setNotice({ text: errMessage(err, "Failed to add subscriber"), isError: true });
    } finally {
      setSaving(false);
    }
  }

  function exportUrl(): string {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (statusFilter) qs.set("status", statusFilter);
    if (localeFilter) qs.set("locale", localeFilter);
    if (sourceFilter) qs.set("source", sourceFilter);
    if (tagFilter) qs.set("tag", tagFilter);
    const q = qs.toString();
    return `/next-api/admin/newsletter/subscribers/export${q ? `?${q}` : ""}`;
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Subscribers {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
        <div className={ui.rowActions}>
          <a href={exportUrl()} target="_blank" rel="noreferrer">
            <Button variant="secondary">Export CSV</Button>
          </a>
          <Button onClick={() => setAddOpen(true)}>Add subscriber</Button>
        </div>
      </div>

      {notice && (
        <p className={notice.isError ? ui.error : undefined} style={{ marginTop: "-0.5rem", marginBottom: "1rem", fontSize: "0.85rem", color: notice.isError ? undefined : "var(--color-primary)" }}>
          {notice.text}
        </p>
      )}

      <div className={ui.toolbar} style={{ marginBottom: "1rem" }}>
        <input
          className={ui.searchInput}
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyFilters();
          }}
        />
        <select className={ui.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="subscribed">Subscribed</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="bounced">Bounced</option>
        </select>
        <select className={ui.select} value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value)}>
          <option value="">All locales</option>
          <option value="fr">French</option>
          <option value="en">English</option>
        </select>
        <input className={ui.searchInput} placeholder="Source…" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} />
        <input className={ui.searchInput} placeholder="Tag…" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} />
        <Button variant="secondary" onClick={applyFilters}>
          Filter
        </Button>
      </div>

      {selected.size > 0 && (
        <div className={ui.toolbar} style={{ marginBottom: "1rem", background: "var(--color-surface-tint)", padding: "0.6rem 0.85rem", borderRadius: 10 }}>
          <span style={{ fontSize: "0.85rem" }}>{selected.size} selected</span>
          <select className={ui.select} value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
            {BULK_ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          {(bulkAction === "add_tag" || bulkAction === "remove_tag") && <input className={ui.searchInput} placeholder="Tag name…" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} />}
          <Button onClick={runBulkAction}>Apply</Button>
        </div>
      )}

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : subscribers.length === 0 ? (
          <div className={ui.emptyState}>No subscribers found.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={selected.size > 0 && selected.size === subscribers.length} onChange={toggleSelectAll} />
                </th>
                <th>Email</th>
                <th>Status</th>
                <th>Locale</th>
                <th>Source</th>
                <th>Tags</th>
                <th>Subscribed</th>
                <th>Last activity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} />
                  </td>
                  <td>{s.email}</td>
                  <td>
                    <select className={ui.select} value={s.status} onChange={(e) => changeStatus(s.id, e.target.value as SubscriberStatus)}>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{s.locale ?? "—"}</td>
                  <td style={{ color: "var(--color-secondary)" }}>{s.source ?? "—"}</td>
                  <td style={{ color: "var(--color-secondary)" }}>{s.tags?.length ? s.tags.join(", ") : "—"}</td>
                  <td style={{ color: "var(--color-secondary)" }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td style={{ color: "var(--color-secondary)" }}>{s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleDateString() : "—"}</td>
                  <td>
                    <Button variant="danger" onClick={() => deleteOne(s.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && pages > 1 && (
        <div className={ui.toolbar} style={{ marginTop: "1rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>{total} subscribers</span>
          {Array.from({ length: pages }, (_, i) => (
            <Button key={i} variant={page === i + 1 ? "primary" : "secondary"} onClick={() => setPage(i + 1)}>
              {i + 1}
            </Button>
          ))}
        </div>
      )}

      {addOpen && (
        <Modal
          title="Add subscriber"
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createSubscriber} disabled={saving}>
                {saving ? "Saving…" : "Add"}
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={ui.field}>
              <label className={ui.label}>Email</label>
              <input className={ui.input} type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} autoFocus />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Locale</label>
              <input className={ui.input} placeholder="fr / en" value={addLocale} onChange={(e) => setAddLocale(e.target.value)} />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Source</label>
              <input className={ui.input} placeholder="admin-manual" value={addSource} onChange={(e) => setAddSource(e.target.value)} />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Tags (comma-separated)</label>
              <input className={ui.input} value={addTags} onChange={(e) => setAddTags(e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
