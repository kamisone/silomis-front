"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface TaxRate {
  id: string;
  countryCode: string | null;
  categoryId: string | null;
  ratePct: string | number;
  label: string;
  isActive: boolean;
  category?: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

interface TaxRateForm {
  id: string | null;
  countryCode: string;
  categoryId: string;
  ratePct: string;
  label: string;
  isActive: boolean;
}

const EMPTY_FORM: TaxRateForm = { id: null, countryCode: "", categoryId: "", ratePct: "20", label: "VAT", isActive: true };
const FORM_ID = "tax-rate-form";

function isDefault(r: TaxRate): boolean {
  return r.countryCode === null && r.categoryId === null;
}

function scopeLabel(r: TaxRate): string {
  if (isDefault(r)) return "Store default";
  const parts = [];
  if (r.countryCode) parts.push(r.countryCode);
  if (r.categoryId) parts.push(r.category?.name ?? "category");
  return parts.join(" / ");
}

function rateToForm(r: TaxRate): TaxRateForm {
  return { id: r.id, countryCode: r.countryCode ?? "", categoryId: r.categoryId ?? "", ratePct: String(r.ratePct), label: r.label, isActive: r.isActive };
}

export default function TaxRatesPage() {
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<TaxRateForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [rateRes, cats] = await Promise.all([api.get<TaxRate[]>("/next-api/admin/shop/tax-rates"), api.get<Category[]>("/next-api/admin/shop/categories")]);
      setRates(rateRes);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setError(null);
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(r: TaxRate) {
    setError(null);
    setForm(rateToForm(r));
  }

  function closeModal() {
    setForm(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    const payload = {
      countryCode: form.countryCode.trim().toUpperCase() || null,
      categoryId: form.categoryId || null,
      ratePct: parseFloat(form.ratePct || "0"),
      label: form.label || "VAT",
      isActive: form.isActive,
    };
    try {
      if (form.id) {
        await api.patch(`/next-api/admin/shop/tax-rates/${form.id}`, payload);
      } else {
        await api.post("/next-api/admin/shop/tax-rates", payload);
      }
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: TaxRate) {
    if (!confirm(`Delete tax rate "${scopeLabel(r)}"?`)) return;
    try {
      await api.delete(`/next-api/admin/shop/tax-rates/${r.id}`);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Delete failed") : "Delete failed");
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Tax rates</h1>
        <Button onClick={openCreate}>New tax rate</Button>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)", marginTop: "-0.5rem" }}>
        Config-only — used for invoice/receipt display. Prices stay tax-inclusive; checkout totals are unaffected.
      </p>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Scope</th>
                <th>Rate</th>
                <th>Label</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id}>
                  <td>{scopeLabel(r)}</td>
                  <td>{Number(r.ratePct)}%</td>
                  <td>{r.label}</td>
                  <td>
                    <span className={r.isActive ? ui.badgeActive : ui.badgeInactive}>{r.isActive ? "active" : "inactive"}</span>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button variant="secondary" onClick={() => openEdit(r)}>
                        Edit
                      </Button>
                      {!isDefault(r) && (
                        <Button variant="danger" onClick={() => handleDelete(r)}>
                          Delete
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

      {form && (
        <Modal
          title={form.id ? "Edit tax rate" : "New tax rate"}
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

            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Country code (optional, ISO 3166-1 alpha-2)</label>
                <input className={ui.input} value={form.countryCode} maxLength={2} placeholder="FR" onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })} />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Category (optional)</label>
                <select className={ui.select} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Rate (%)</label>
                <input className={ui.input} type="number" min={0} max={100} step={0.01} value={form.ratePct} onChange={(e) => setForm({ ...form, ratePct: e.target.value })} required />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Label</label>
                <input className={ui.input} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>

            <p style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>Leave both country and category empty to edit the store-wide default rate.</p>
          </form>
        </Modal>
      )}
    </div>
  );
}
