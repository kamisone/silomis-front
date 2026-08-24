"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface PaymentType {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

interface FormState {
  id: string | null;
  code: string;
  name: string;
  isActive: boolean;
}

const FORM_ID = "payment-type-form";

export default function PaymentTypesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<PaymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setItems(await api.get<PaymentType[]>("/next-api/admin/shop/payment-types"));
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
    try {
      const payload = { code: form.code, name: form.name, isActive: form.isActive };
      if (form.id) await api.patch(`/next-api/admin/shop/payment-types/${form.id}`, payload);
      else await api.post("/next-api/admin/shop/payment-types", payload);
      setForm(null);
      await load();
      toast.success(isNew ? "Payment type created" : "Payment type updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to save payment type") : "Failed to save payment type");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pt: PaymentType) {
    if (!confirm(`Delete payment type "${pt.name}"?`)) return;
    try {
      await api.delete(`/next-api/admin/shop/payment-types/${pt.id}`);
      await load();
      toast.success("Payment type deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to delete payment type") : "Failed to delete payment type");
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Payment types</h1>
        <Button onClick={() => setForm({ id: null, code: "", name: "", isActive: true })}>New payment type</Button>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No payment types yet — add one (e.g. "card") to offer it at checkout later.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((pt) => (
                <tr key={pt.id}>
                  <td>{pt.name}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{pt.code}</td>
                  <td>
                    <span className={pt.isActive ? ui.badgeActive : ui.badgeInactive}>{pt.isActive ? "active" : "inactive"}</span>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button variant="secondary" onClick={() => setForm({ id: pt.id, code: pt.code, name: pt.name, isActive: pt.isActive })}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => handleDelete(pt)}>
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
          title={form.id ? "Edit payment type" : "New payment type"}
          onClose={() => setForm(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <form id={FORM_ID} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={ui.field}>
              <label className={ui.label}>Name</label>
              <input className={ui.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus placeholder="e.g. Credit / Debit Card" />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Code</label>
              <input className={ui.input} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="e.g. card" />
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
