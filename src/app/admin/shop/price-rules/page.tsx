"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

type PriceRuleType = "percentage_off" | "fixed_off" | "override";
type PriceRuleScope = "variant" | "product" | "global";

interface PriceRule {
  id: string;
  name: string;
  type: PriceRuleType;
  value: number;
  scope: PriceRuleScope;
  variantId: string | null;
  productId: string | null;
  minQty: number;
  priority: number;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  product?: { id: string; title: string } | null;
  variant?: { id: string; title: string; sku: string } | null;
}

interface ProductLite {
  id: string;
  title: string;
}

interface VariantLite {
  id: string;
  title: string;
  sku: string;
}

interface PriceRuleForm {
  id: string | null;
  name: string;
  type: PriceRuleType;
  value: string;
  scope: PriceRuleScope;
  variantId: string;
  productId: string;
  minQty: string;
  priority: string;
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
}

const EMPTY_FORM: PriceRuleForm = {
  id: null,
  name: "",
  type: "percentage_off",
  value: "10",
  scope: "product",
  variantId: "",
  productId: "",
  minQty: "1",
  priority: "0",
  isActive: true,
  startsAt: "",
  expiresAt: "",
};

const FORM_ID = "price-rule-form";

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

function formatValue(r: PriceRule): string {
  if (r.type === "percentage_off") return `${r.value}%`;
  const amount = (r.value / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
  return r.type === "override" ? `= ${amount}` : amount;
}

function ruleToForm(r: PriceRule): PriceRuleForm {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    value: String(r.value),
    scope: r.scope,
    variantId: r.variantId ?? "",
    productId: r.productId ?? "",
    minQty: String(r.minQty),
    priority: String(r.priority),
    isActive: r.isActive,
    startsAt: toDatetimeLocal(r.startsAt),
    expiresAt: toDatetimeLocal(r.expiresAt),
  };
}

export default function PriceRulesPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [variants, setVariants] = useState<VariantLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PriceRuleForm | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [ruleRes, prodRes] = await Promise.all([
        api.get<{ items: PriceRule[]; total: number }>("/next-api/admin/shop/price-rules?limit=200"),
        api.get<{ items: ProductLite[]; total: number }>("/next-api/admin/shop/products?limit=200"),
      ]);
      setRules(ruleRes.items);
      setProducts(prodRes.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, []);

  async function loadVariants(productId: string) {
    if (!productId) {
      setVariants([]);
      return;
    }
    const product = await api.get<{ variants: VariantLite[] }>(`/next-api/admin/shop/products/${productId}`);
    setVariants(product.variants ?? []);
  }

  function openCreate() {
    setVariants([]);
    setForm({ ...EMPTY_FORM });
  }

  async function openEdit(r: PriceRule) {
    setForm(ruleToForm(r));
    if (r.scope === "variant" && r.productId) await loadVariants(r.productId);
    else setVariants([]);
  }

  function closeModal() {
    setForm(null);
    setVariants([]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const isNew = !form.id;
    const payload = {
      name: form.name,
      type: form.type,
      value: parseInt(form.value || "0", 10),
      scope: form.scope,
      variantId: form.scope === "variant" ? form.variantId || null : null,
      productId: form.scope === "product" || form.scope === "variant" ? form.productId || null : null,
      minQty: parseInt(form.minQty || "1", 10),
      priority: parseInt(form.priority || "0", 10),
      isActive: form.isActive,
      startsAt: fromDatetimeLocal(form.startsAt),
      expiresAt: fromDatetimeLocal(form.expiresAt),
    };
    try {
      if (form.id) {
        await api.patch(`/next-api/admin/shop/price-rules/${form.id}`, payload);
      } else {
        await api.post("/next-api/admin/shop/price-rules", payload);
      }
      closeModal();
      await load();
      toast.success(isNew ? "Price rule created" : "Price rule updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to save price rule") : "Failed to save price rule");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: PriceRule) {
    if (!confirm(`Delete price rule "${r.name}"?`)) return;
    try {
      await api.delete(`/next-api/admin/shop/price-rules/${r.id}`);
      await load();
      toast.success("Price rule deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to delete price rule") : "Failed to delete price rule");
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Price rules</h1>
        <Button onClick={openCreate}>New price rule</Button>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)", marginTop: "-0.5rem" }}>
        Quantity-gated discounts applied inside the pricing engine, on top of any matching promotion. This is separate from per-product quantity-tier pricing (Products →
        upselling).
      </p>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : rules.length === 0 ? (
          <div className={ui.emptyState}>No price rules yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Scope</th>
                <th>Value</th>
                <th>Min qty</th>
                <th>Priority</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.scope === "global" ? "Global" : r.scope === "product" ? (r.product?.title ?? "Product") : (r.variant ? `${r.variant.title} (${r.variant.sku})` : "Variant")}</td>
                  <td>{formatValue(r)}</td>
                  <td>{r.minQty}</td>
                  <td>{r.priority}</td>
                  <td>
                    <span className={r.isActive ? ui.badgeActive : ui.badgeInactive}>{r.isActive ? "active" : "inactive"}</span>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button variant="secondary" onClick={() => openEdit(r)}>
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
          title={form.id ? "Edit price rule" : "New price rule"}
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
            <div className={ui.field}>
              <label className={ui.label}>Name</label>
              <input className={ui.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
            </div>

            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Type</label>
                <select className={ui.select} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PriceRuleType })}>
                  <option value="percentage_off">Percentage off</option>
                  <option value="fixed_off">Fixed amount off (cents)</option>
                  <option value="override">Set exact price (cents)</option>
                </select>
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Value{form.type === "percentage_off" ? " (%)" : " (cents)"}</label>
                <input
                  className={ui.input}
                  type="number"
                  min={0}
                  max={form.type === "percentage_off" ? 100 : undefined}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </div>
            </div>

            <div className={ui.field}>
              <label className={ui.label}>Scope</label>
              <select
                className={ui.select}
                value={form.scope}
                onChange={(e) => {
                  const scope = e.target.value as PriceRuleScope;
                  setForm({ ...form, scope, productId: scope === "global" ? "" : form.productId, variantId: scope === "variant" ? form.variantId : "" });
                  if (scope !== "variant") setVariants([]);
                }}
              >
                <option value="global">Global (every product)</option>
                <option value="product">Specific product</option>
                <option value="variant">Specific variant</option>
              </select>
            </div>

            {(form.scope === "product" || form.scope === "variant") && (
              <div className={ui.field}>
                <label className={ui.label}>Product</label>
                <select
                  className={ui.select}
                  value={form.productId}
                  onChange={async (e) => {
                    const productId = e.target.value;
                    setForm({ ...form, productId, variantId: "" });
                    if (form.scope === "variant") await loadVariants(productId);
                  }}
                  required
                >
                  <option value="">Select a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.scope === "variant" && form.productId && (
              <div className={ui.field}>
                <label className={ui.label}>Variant</label>
                <select className={ui.select} value={form.variantId} onChange={(e) => setForm({ ...form, variantId: e.target.value })} required>
                  <option value="">Select a variant…</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({v.sku})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Min quantity</label>
                <input className={ui.input} type="number" min={1} value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Priority</label>
                <input className={ui.input} type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </div>
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
          </form>
        </Modal>
      )}
    </div>
  );
}
