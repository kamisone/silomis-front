"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  bannerImageKey: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface CampaignPerformance {
  promotionCount: number;
  totalUses: number;
  promotions: Array<{ id: string; name: string; usesCount: number; maxUsesTotal: number | null }>;
}

interface CampaignForm {
  id: string | null;
  name: string;
  description: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

const EMPTY_FORM: CampaignForm = { id: null, name: "", description: "", startsAt: "", expiresAt: "", isActive: true };
const FORM_ID = "campaign-form";

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function campaignToForm(c: Campaign): CampaignForm {
  return { id: c.id, name: c.name, description: c.description ?? "", startsAt: toDatetimeLocal(c.startsAt), expiresAt: toDatetimeLocal(c.expiresAt), isActive: c.isActive };
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CampaignForm | null>(null);
  const [performance, setPerformance] = useState<CampaignPerformance | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Campaign[]; total: number }>("/next-api/admin/shop/campaigns?limit=200");
      setCampaigns(res.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setError(null);
    setPerformance(null);
    setForm({ ...EMPTY_FORM });
  }

  async function openEdit(c: Campaign) {
    setError(null);
    setForm(campaignToForm(c));
    try {
      setPerformance(await api.get<CampaignPerformance>(`/next-api/admin/shop/campaigns/${c.id}/performance`));
    } catch {
      setPerformance(null);
    }
  }

  function closeModal() {
    setForm(null);
    setPerformance(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      description: form.description || null,
      startsAt: fromDatetimeLocal(form.startsAt),
      expiresAt: fromDatetimeLocal(form.expiresAt),
      isActive: form.isActive,
    };
    try {
      if (form.id) {
        await api.patch(`/next-api/admin/shop/campaigns/${form.id}`, payload);
      } else {
        await api.post("/next-api/admin/shop/campaigns", payload);
      }
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Campaign) {
    if (!confirm(`Delete campaign "${c.name}"? Linked promotions are kept, just un-grouped.`)) return;
    try {
      await api.delete(`/next-api/admin/shop/campaigns/${c.id}`);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Delete failed") : "Delete failed");
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Campaigns</h1>
        <Button onClick={openCreate}>New campaign</Button>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className={ui.emptyState}>No campaigns yet. Group related promotions together to track them as one.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Starts</th>
                <th>Expires</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{formatDate(c.startsAt)}</td>
                  <td>{formatDate(c.expiresAt)}</td>
                  <td>
                    <span className={c.isActive ? ui.badgeActive : ui.badgeInactive}>{c.isActive ? "active" : "inactive"}</span>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button variant="secondary" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => handleDelete(c)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal
          title={form.id ? "Edit campaign" : "New campaign"}
          onClose={closeModal}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <form id={FORM_ID} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {error && <p className={ui.error}>{error}</p>}

            <div className={ui.field}>
              <label className={ui.label}>Name</label>
              <input className={ui.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
            </div>

            <div className={ui.field}>
              <label className={ui.label}>Description (optional)</label>
              <textarea className={ui.textarea} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Starts at (optional)</label>
                <input className={ui.input} type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Expires at (optional)</label>
                <input className={ui.input} type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>

            {performance && (
              <div className={ui.field}>
                <label className={ui.label}>
                  Performance ({performance.promotionCount} promotion{performance.promotionCount === 1 ? "" : "s"} linked, {performance.totalUses} total use
                  {performance.totalUses === 1 ? "" : "s"})
                </label>
                {performance.promotions.length > 0 && (
                  <div className={ui.chipList}>
                    {performance.promotions.map((p) => (
                      <span key={p.id} className={ui.chip}>
                        {p.name} — {p.usesCount}/{p.maxUsesTotal ?? "∞"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!form.id && <p style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>Link promotions to this campaign from the Promotions page once it&apos;s saved.</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
