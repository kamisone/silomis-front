"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface CustomerGroup {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

interface FormState {
  id: string | null;
  name: string;
  description: string;
  isActive: boolean;
}

const FORM_ID = "customer-group-form";

export default function CustomerGroupsPage() {
  const [items, setItems] = useState<CustomerGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ items: CustomerGroup[]; total: number }>("/next-api/admin/shop/customers/groups?limit=100");
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { name: form.name, description: form.description || null, isActive: form.isActive };
      if (form.id) await api.patch(`/next-api/admin/shop/customers/groups/${form.id}`, payload);
      else await api.post("/next-api/admin/shop/customers/groups", payload);
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(group: CustomerGroup) {
    if (!confirm(`Delete group "${group.name}"?`)) return;
    await api.delete(`/next-api/admin/shop/customers/groups/${group.id}`);
    await load();
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Customer Groups {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
        <Button onClick={() => setForm({ id: null, name: "", description: "", isActive: true })}>New group</Button>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No customer groups yet — groups are a free-form segment definition your admin tooling can filter customers by.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((g) => (
                <tr key={g.id}>
                  <td style={{ fontWeight: 600 }}>{g.name}</td>
                  <td>{g.description ?? "—"}</td>
                  <td>
                    <span className={g.isActive ? ui.badgeActive : ui.badgeInactive}>{g.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td>{new Date(g.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button variant="secondary" onClick={() => setForm({ id: g.id, name: g.name, description: g.description ?? "", isActive: g.isActive })}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => handleDelete(g)}>
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
          title={form.id ? "Edit group" : "New group"}
          onClose={() => setForm(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} disabled={saving || !form.name.trim()}>
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
              <input className={ui.input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
}
