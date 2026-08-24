"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface OrderStatusRef {
  id: string;
  code: string;
  label: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface FormState {
  id: string | null;
  code: string;
  label: string;
  description: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { id: null, code: "", label: "", description: "", color: "#6b7280", sortOrder: 0, isActive: true };
const FORM_ID = "order-status-ref-form";

export default function OrderStatusRefsPage() {
  const { toast } = useToast();
  const [refs, setRefs] = useState<OrderStatusRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<OrderStatusRef[]>("/next-api/admin/shop/order-status-refs");
      setRefs(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const isNew = !form.id;
    const payload = {
      code: form.code,
      label: form.label,
      description: form.description || null,
      color: form.color || null,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
    };
    try {
      if (form.id) {
        await api.patch(`/next-api/admin/shop/order-status-refs/${form.id}`, payload);
      } else {
        await api.post("/next-api/admin/shop/order-status-refs", payload);
      }
      setForm(null);
      await load();
      toast.success(isNew ? "Status created" : "Status updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to save status") : "Failed to save status");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ref: OrderStatusRef) {
    if (!confirm(`Delete order status "${ref.label}"?`)) return;
    try {
      await api.delete(`/next-api/admin/shop/order-status-refs/${ref.id}`);
      await load();
      toast.success("Status deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to delete status") : "Failed to delete status");
    }
  }

  const sorted = [...refs].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Order Statuses</h1>
        <Button onClick={() => setForm({ ...EMPTY_FORM })}>New status</Button>
      </div>
      <p style={{ color: "var(--color-secondary)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        Define the order status lifecycle used for display and analytics. Transition logic itself is enforced at the order service level.
      </p>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div className={ui.emptyState}>No order statuses yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Label</th>
                <th>Color</th>
                <th>Order</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code style={{ fontSize: 12, background: "var(--color-surface)", padding: "2px 6px", borderRadius: 4 }}>{r.code}</code>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: "50%", background: r.color ?? "#6b7280", flexShrink: 0 }} />
                      <strong>{r.label}</strong>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 18, height: 18, borderRadius: 4, background: r.color ?? "#6b7280", border: "1px solid var(--color-surface)" }} />
                      <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>{r.color ?? "—"}</span>
                    </div>
                  </td>
                  <td>{r.sortOrder}</td>
                  <td>
                    <span className={r.isActive ? ui.badgeActive : ui.badgeInactive}>{r.isActive ? "active" : "inactive"}</span>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setForm({
                            id: r.id,
                            code: r.code,
                            label: r.label,
                            description: r.description ?? "",
                            color: r.color ?? "#6b7280",
                            sortOrder: r.sortOrder,
                            isActive: r.isActive,
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => handleDelete(r)}>
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
          title={form.id ? "Edit order status" : "New order status"}
          onClose={() => setForm(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} disabled={saving || !form.code || !form.label}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <form id={FORM_ID} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={ui.field}>
              <label className={ui.label}>Code *</label>
              <input
                className={ui.input}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="pending, paid, shipped…"
              />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Label *</label>
              <input
                className={ui.input}
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Pending Payment"
              />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Description</label>
              <input
                className={ui.input}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief explanation of this status"
              />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Color</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  style={{ width: 40, height: 36, padding: 2, border: "1px solid var(--color-surface)", borderRadius: 6 }}
                />
                <input className={ui.input} style={{ flex: 1 }} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Sort order</label>
              <input
                className={ui.input}
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
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
