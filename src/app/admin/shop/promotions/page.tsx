"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

type PromotionTrigger = "automatic" | "coupon";
type PromotionScope = "site_wide" | "category" | "product";
type PromotionDiscountType = "percentage" | "fixed_amount" | "free_shipping";

interface CategoryLink {
  id: string;
  categoryId: string;
  category: { id: string; name: string };
}

interface ProductLink {
  id: string;
  productId: string;
  product: { id: string; title: string };
}

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  marketingLabel: string | null;
  bannerText: string | null;
  trigger: PromotionTrigger;
  code: string | null;
  discountType: PromotionDiscountType;
  discountValue: number;
  scope: PromotionScope;
  minOrderCents: number | null;
  maxUsesTotal: number | null;
  usesCount: number;
  priority: number;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  campaignId: string | null;
  createdAt: string;
  updatedAt: string;
  categoryLinks?: CategoryLink[];
  productLinks?: ProductLink[];
}

interface PromotionForm {
  id: string | null;
  name: string;
  description: string;
  marketingLabel: string;
  bannerText: string;
  trigger: PromotionTrigger;
  code: string;
  discountType: PromotionDiscountType;
  discountValue: string;
  scope: PromotionScope;
  minOrderCents: string;
  maxUsesTotal: string;
  priority: string;
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
  campaignId: string;
}

interface Category {
  id: string;
  name: string;
}

interface ProductLite {
  id: string;
  title: string;
}

interface CampaignLite {
  id: string;
  name: string;
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

function formatDiscount(p: Promotion): string {
  if (p.discountType === "percentage") return `${p.discountValue}%`;
  if (p.discountType === "fixed_amount") return eur(p.discountValue);
  return "Free shipping";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

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

const EMPTY_FORM: PromotionForm = {
  id: null,
  name: "",
  description: "",
  marketingLabel: "",
  bannerText: "",
  trigger: "automatic",
  code: "",
  discountType: "percentage",
  discountValue: "10",
  scope: "site_wide",
  minOrderCents: "",
  maxUsesTotal: "",
  priority: "0",
  isActive: true,
  startsAt: "",
  expiresAt: "",
  campaignId: "",
};

const FORM_ID = "promotion-form";

function promotionToForm(p: Promotion): PromotionForm {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    marketingLabel: p.marketingLabel ?? "",
    bannerText: p.bannerText ?? "",
    trigger: p.trigger,
    code: p.code ?? "",
    discountType: p.discountType,
    discountValue: String(p.discountValue),
    scope: p.scope,
    minOrderCents: p.minOrderCents !== null ? String(p.minOrderCents) : "",
    maxUsesTotal: p.maxUsesTotal !== null ? String(p.maxUsesTotal) : "",
    priority: String(p.priority),
    isActive: p.isActive,
    startsAt: toDatetimeLocal(p.startsAt),
    expiresAt: toDatetimeLocal(p.expiresAt),
    campaignId: p.campaignId ?? "",
  };
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PromotionForm | null>(null);
  const [detail, setDetail] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [promoRes, cats, prodRes, campaignRes] = await Promise.all([
        api.get<{ items: Promotion[]; total: number }>("/next-api/admin/shop/promotions?limit=200"),
        api.get<Category[]>("/next-api/admin/shop/categories"),
        api.get<{ items: ProductLite[]; total: number }>("/next-api/admin/shop/products?limit=200"),
        api.get<{ items: CampaignLite[]; total: number }>("/next-api/admin/shop/campaigns?limit=200"),
      ]);
      setPromotions(promoRes.items);
      setCategories(cats);
      setProducts(prodRes.items);
      setCampaigns(campaignRes.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setError(null);
    setDetail(null);
    setForm({ ...EMPTY_FORM });
  }

  async function openEdit(p: Promotion) {
    setError(null);
    try {
      const full = await api.get<Promotion>(`/next-api/admin/shop/promotions/${p.id}`);
      setDetail(full);
      setForm(promotionToForm(full));
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to load promotion") : "Failed to load promotion");
    }
  }

  function closeModal() {
    setForm(null);
    setDetail(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      description: form.description || null,
      marketingLabel: form.marketingLabel || null,
      bannerText: form.bannerText || null,
      trigger: form.trigger,
      code: form.trigger === "coupon" ? form.code.trim().toUpperCase() : null,
      discountType: form.discountType,
      discountValue: form.discountType === "free_shipping" ? 0 : parseInt(form.discountValue || "0", 10),
      scope: form.scope,
      minOrderCents: form.minOrderCents ? parseInt(form.minOrderCents, 10) : null,
      maxUsesTotal: form.maxUsesTotal ? parseInt(form.maxUsesTotal, 10) : null,
      priority: parseInt(form.priority || "0", 10),
      isActive: form.isActive,
      startsAt: fromDatetimeLocal(form.startsAt),
      expiresAt: fromDatetimeLocal(form.expiresAt),
      campaignId: form.campaignId || null,
    };
    try {
      if (form.id) {
        await api.patch(`/next-api/admin/shop/promotions/${form.id}`, payload);
      } else {
        await api.post("/next-api/admin/shop/promotions", payload);
      }
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Promotion) {
    if (!confirm(`Delete promotion "${p.name}"?`)) return;
    try {
      await api.delete(`/next-api/admin/shop/promotions/${p.id}`);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Delete failed") : "Delete failed");
    }
  }

  async function refreshDetail(id: string) {
    const full = await api.get<Promotion>(`/next-api/admin/shop/promotions/${id}`);
    setDetail(full);
  }

  async function addCategoryLink(categoryId: string) {
    if (!detail || !categoryId) return;
    try {
      await api.post(`/next-api/admin/shop/promotions/${detail.id}/category-links`, { categoryId });
      await refreshDetail(detail.id);
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to add category") : "Failed to add category");
    }
  }

  async function removeCategoryLink(linkId: string) {
    if (!detail) return;
    try {
      await api.delete(`/next-api/admin/shop/promotions/${detail.id}/category-links/${linkId}`);
      await refreshDetail(detail.id);
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to remove category") : "Failed to remove category");
    }
  }

  async function addProductLink(productId: string) {
    if (!detail || !productId) return;
    try {
      await api.post(`/next-api/admin/shop/promotions/${detail.id}/product-links`, { productId });
      await refreshDetail(detail.id);
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to add product") : "Failed to add product");
    }
  }

  async function removeProductLink(linkId: string) {
    if (!detail) return;
    try {
      await api.delete(`/next-api/admin/shop/promotions/${detail.id}/product-links/${linkId}`);
      await refreshDetail(detail.id);
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to remove product") : "Failed to remove product");
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Promotions</h1>
        <Button onClick={openCreate}>New promotion</Button>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : promotions.length === 0 ? (
          <div className={ui.emptyState}>No promotions yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Trigger</th>
                <th>Scope</th>
                <th>Discount</th>
                <th>Uses</th>
                <th>Priority</th>
                <th>Expires</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    {p.trigger === "coupon" && p.code && <span className={ui.codeChip}>{p.code}</span>}
                  </td>
                  <td>
                    <span className={ui.badge}>{p.trigger}</span>
                  </td>
                  <td>{p.scope.replace("_", " ")}</td>
                  <td>{formatDiscount(p)}</td>
                  <td>
                    {p.usesCount} / {p.maxUsesTotal ?? "∞"}
                  </td>
                  <td>{p.priority}</td>
                  <td>{formatDate(p.expiresAt)}</td>
                  <td>
                    <span className={p.isActive ? ui.badgeActive : ui.badgeInactive}>{p.isActive ? "active" : "inactive"}</span>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button variant="secondary" onClick={() => openEdit(p)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => handleDelete(p)}>
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
          title={form.id ? "Edit promotion" : "New promotion"}
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
              <label className={ui.label}>Description (optional, admin-only)</label>
              <textarea className={ui.textarea} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Marketing label (optional, storefront badge)</label>
                <input className={ui.input} value={form.marketingLabel} onChange={(e) => setForm({ ...form, marketingLabel: e.target.value })} placeholder="Summer Sale" />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Banner text (optional, storefront copy)</label>
                <input className={ui.input} value={form.bannerText} onChange={(e) => setForm({ ...form, bannerText: e.target.value })} />
              </div>
            </div>

            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Trigger</label>
                <select
                  className={ui.select}
                  value={form.trigger}
                  onChange={(e) => {
                    const trigger = e.target.value as PromotionTrigger;
                    setForm({ ...form, trigger, code: trigger === "automatic" ? "" : form.code });
                  }}
                >
                  <option value="automatic">Automatic</option>
                  <option value="coupon">Coupon</option>
                </select>
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Coupon code</label>
                <input
                  className={ui.input}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  disabled={form.trigger !== "coupon"}
                  placeholder={form.trigger === "coupon" ? "SUMMER10" : "—"}
                  required={form.trigger === "coupon"}
                />
              </div>
            </div>

            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Discount type</label>
                <select
                  className={ui.select}
                  value={form.discountType}
                  onChange={(e) => {
                    const discountType = e.target.value as PromotionDiscountType;
                    setForm({ ...form, discountType, discountValue: discountType === "free_shipping" ? "0" : form.discountValue });
                  }}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed_amount">Fixed amount (cents)</option>
                  <option value="free_shipping">Free shipping</option>
                </select>
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Discount value{form.discountType === "percentage" ? " (%)" : form.discountType === "fixed_amount" ? " (cents)" : ""}</label>
                <input
                  className={ui.input}
                  type="number"
                  min={0}
                  max={form.discountType === "percentage" ? 100 : undefined}
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  disabled={form.discountType === "free_shipping"}
                />
              </div>
            </div>

            <div className={ui.field}>
              <label className={ui.label}>Scope</label>
              <select className={ui.select} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as PromotionScope })}>
                <option value="site_wide">Site-wide</option>
                <option value="category">Category</option>
                <option value="product">Product</option>
              </select>
            </div>

            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Priority</label>
                <input className={ui.input} type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Min order (cents, optional)</label>
                <input className={ui.input} type="number" min={0} value={form.minOrderCents} onChange={(e) => setForm({ ...form, minOrderCents: e.target.value })} />
              </div>
            </div>

            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Max uses (optional, empty = unlimited)</label>
                <input className={ui.input} type="number" min={0} value={form.maxUsesTotal} onChange={(e) => setForm({ ...form, maxUsesTotal: e.target.value })} />
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

            <div className={ui.field}>
              <label className={ui.label}>Campaign (optional)</label>
              <select className={ui.select} value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
                <option value="">No campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>

            {detail && form.scope === "category" && (
              <div className={ui.field}>
                <label className={ui.label}>Category links</label>
                <div className={ui.chipList}>
                  {(detail.categoryLinks ?? []).map((link) => (
                    <span key={link.id} className={ui.chip}>
                      {link.category?.name ?? categories.find((c) => c.id === link.categoryId)?.name ?? link.categoryId}
                      <button type="button" className={ui.chipRemove} onClick={() => removeCategoryLink(link.id)} aria-label="Remove">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <select
                  className={ui.select}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addCategoryLink(e.target.value);
                  }}
                >
                  <option value="">Add category…</option>
                  {categories
                    .filter((c) => !(detail.categoryLinks ?? []).some((l) => l.categoryId === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {detail && form.scope === "product" && (
              <div className={ui.field}>
                <label className={ui.label}>Product links</label>
                <div className={ui.chipList}>
                  {(detail.productLinks ?? []).map((link) => (
                    <span key={link.id} className={ui.chip}>
                      {link.product?.title ?? products.find((pr) => pr.id === link.productId)?.title ?? link.productId}
                      <button type="button" className={ui.chipRemove} onClick={() => removeProductLink(link.id)} aria-label="Remove">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <select
                  className={ui.select}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addProductLink(e.target.value);
                  }}
                >
                  <option value="">Add product…</option>
                  {products
                    .filter((pr) => !(detail.productLinks ?? []).some((l) => l.productId === pr.id))
                    .map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.title}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {!detail && form.scope !== "site_wide" && (
              <p style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>
                Save this promotion first, then reopen it to link specific {form.scope === "category" ? "categories" : "products"}.
              </p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
