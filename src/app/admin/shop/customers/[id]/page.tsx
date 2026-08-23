"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface Address {
  id: string;
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  marketingOptIn: boolean;
  totalOrders: number;
  totalSpentCents: number;
  createdAt: string;
  addresses: Address[];
}

interface AddressForm {
  id: string | null;
  name: string;
  line1: string;
  line2: string;
  city: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

interface TimelineEntry {
  type: string;
  date: string;
  productId: string | null;
  productTitle: string | null;
  searchQuery: string | null;
  resultCount: number | null;
  quantity: number | null;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  totalCents: number | null;
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

function describeTimelineEntry(e: TimelineEntry): string {
  switch (e.type) {
    case "product_view":
      return `Viewed ${e.productTitle ?? "a product"}`;
    case "search":
      return `Searched "${e.searchQuery ?? ""}"${e.resultCount != null ? ` — ${e.resultCount} result${e.resultCount === 1 ? "" : "s"}` : ""}`;
    case "add_to_cart":
      return `Added ${e.productTitle ?? "a product"} to cart${e.quantity ? ` (×${e.quantity})` : ""}`;
    case "update_cart_item":
      return `Updated cart quantity for ${e.productTitle ?? "a product"}`;
    case "remove_from_cart":
      return `Removed ${e.productTitle ?? "a product"} from cart`;
    case "checkout_started":
      return `Started checkout${e.productTitle ? ` with ${e.productTitle}` : ""}`;
    case "test_checkout_blocked":
      return `Reached checkout with a test product (${e.productTitle ?? "unknown"}) — blocked before payment`;
    case "order":
      return `Order ${e.orderNumber ?? ""} — ${e.orderStatus ?? ""}${e.totalCents != null ? ` — ${eur(e.totalCents)}` : ""}`;
    case "wishlist_add":
      return `Wishlisted ${e.productTitle ?? "a product"}`;
    default:
      return e.type;
  }
}

const FORM_ID = "customer-address-form";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AddressForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setCustomer(await api.get<Customer>(`/next-api/admin/shop/customers/${id}`));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      setTimelineLoading(true);
      api
        .get<TimelineEntry[]>(`/next-api/admin/shop/customers/${id}/timeline`)
        .then((data) => setTimeline(Array.isArray(data) ? data : []))
        .finally(() => setTimelineLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, [id]);

  function openNewAddress() {
    setError(null);
    setForm({ id: null, name: "", line1: "", line2: "", city: "", zip: "", country: "FR", isDefault: false });
  }
  function openEditAddress(a: Address) {
    setError(null);
    setForm({ id: a.id, name: a.name, line1: a.line1, line2: a.line2 ?? "", city: a.city, zip: a.zip, country: a.country, isDefault: a.isDefault });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form || !customer) return;
    setSaving(true);
    setError(null);
    const payload = { name: form.name, line1: form.line1, line2: form.line2 || null, city: form.city, zip: form.zip, country: form.country, isDefault: form.isDefault };
    try {
      if (form.id) {
        await api.patch(`/next-api/admin/shop/customers/${customer.id}/addresses/${form.id}`, payload);
      } else {
        await api.post(`/next-api/admin/shop/customers/${customer.id}/addresses`, payload);
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAddress(addressId: string) {
    if (!customer || !confirm("Delete this address?")) return;
    await api.delete(`/next-api/admin/shop/customers/${customer.id}/addresses/${addressId}`);
    await load();
  }

  if (loading || !customer) {
    return <div className={ui.emptyState}>Loading…</div>;
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>{customer.firstName || customer.lastName ? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() : customer.email}</h1>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div className={ui.card} style={{ padding: "1rem 1.25rem", minWidth: 140 }}>
          <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>Orders</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-primary)" }}>{customer.totalOrders}</div>
        </div>
        <div className={ui.card} style={{ padding: "1rem 1.25rem", minWidth: 140 }}>
          <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>Lifetime spend</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-primary)" }}>{eur(customer.totalSpentCents)}</div>
        </div>
      </div>

      <div className={ui.card} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <strong style={{ color: "var(--color-primary)" }}>Contact</strong>
        <div>{customer.email}</div>
        {customer.phone && <div style={{ color: "var(--color-secondary)" }}>{customer.phone}</div>}
        <div style={{ color: "var(--color-secondary)", fontSize: "0.85rem" }}>Customer since {new Date(customer.createdAt).toLocaleDateString()}</div>
        <div style={{ fontSize: "0.85rem" }}>
          <span className={customer.marketingOptIn ? ui.badgeActive : ui.badgeInactive}>{customer.marketingOptIn ? "opted in to marketing" : "opted out of marketing"}</span>
        </div>
      </div>

      <div className={ui.card} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className={ui.pageHeader}>
          <strong style={{ color: "var(--color-primary)" }}>Addresses</strong>
          <Button variant="secondary" onClick={openNewAddress}>
            Add address
          </Button>
        </div>
        {customer.addresses.length === 0 ? (
          <p style={{ color: "var(--color-secondary)", fontSize: "0.85rem" }}>No saved addresses yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {customer.addresses.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--color-surface)", paddingBottom: "0.75rem" }}>
                <div style={{ fontSize: "0.9rem" }}>
                  <div style={{ fontWeight: 600 }}>
                    {a.name} {a.isDefault && <span className={ui.badgeActive}>default</span>}
                  </div>
                  <div>{a.line1}</div>
                  {a.line2 && <div>{a.line2}</div>}
                  <div>
                    {a.zip} {a.city}, {a.country}
                  </div>
                </div>
                <div className={ui.rowActions}>
                  <Button variant="secondary" onClick={() => openEditAddress(a)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => handleDeleteAddress(a.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={ui.card} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <strong style={{ color: "var(--color-primary)" }}>Activity timeline</strong>
        {timelineLoading ? (
          <p style={{ color: "var(--color-secondary)", fontSize: "0.85rem" }}>Loading…</p>
        ) : timeline.length === 0 ? (
          <p style={{ color: "var(--color-secondary)", fontSize: "0.85rem" }}>No recorded activity yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: 420, overflowY: "auto" }}>
            {timeline.map((e, i) => (
              <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", fontSize: "0.85rem", borderBottom: "1px solid var(--color-surface)", paddingBottom: "0.6rem" }}>
                <span>{describeTimelineEntry(e)}</span>
                <span style={{ color: "var(--color-secondary)", whiteSpace: "nowrap" }}>{new Date(e.date).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {form && (
        <Modal
          title={form.id ? "Edit address" : "Add address"}
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
            {error && <p className={ui.error}>{error}</p>}
            <div className={ui.field}>
              <label className={ui.label}>Full name</label>
              <input className={ui.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Address line 1</label>
              <input className={ui.input} value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Address line 2 (optional)</label>
              <input className={ui.input} value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
            </div>
            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>City</label>
                <input className={ui.input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>ZIP / postal code</label>
                <input className={ui.input} value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} required />
              </div>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Country (ISO code)</label>
              <input className={ui.input} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} maxLength={2} required />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
              Default address
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
}
