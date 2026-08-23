"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

type ShipmentStatus = "pending" | "label_created" | "in_transit" | "delivered" | "failed";

interface Shipment {
  id: string;
  orderId: string;
  methodId: string | null;
  status: ShipmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

interface FormState {
  id: string | null;
  orderId: string;
  status: ShipmentStatus;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
}

const STATUSES: ShipmentStatus[] = ["pending", "label_created", "in_transit", "delivered", "failed"];
const FORM_ID = "shipment-form";

function badgeClass(status: ShipmentStatus): string {
  if (status === "delivered") return "badgeActive";
  if (status === "failed") return "badgeInactive";
  return "badgeActive";
}

export default function ShipmentsPage() {
  const [items, setItems] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [orderIdFilter, setOrderIdFilter] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (orderIdFilter) params.set("orderId", orderIdFilter);
      const data = await api.get<{ items: Shipment[]; total: number }>(`/next-api/admin/shop/shipments?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIdFilter]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    const payload = {
      status: form.status,
      carrier: form.carrier || null,
      trackingNumber: form.trackingNumber || null,
      trackingUrl: form.trackingUrl || null,
    };
    try {
      if (form.id) {
        await api.patch(`/next-api/admin/shop/shipments/${form.id}`, payload);
      } else {
        await api.post("/next-api/admin/shop/shipments", { orderId: form.orderId, ...payload });
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Shipments {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
        <Button onClick={() => setForm({ id: null, orderId: "", status: "pending", carrier: "", trackingNumber: "", trackingUrl: "" })}>New shipment</Button>
      </div>

      <div className={ui.toolbar}>
        <input className={ui.searchInput} placeholder="Filter by order id…" value={orderIdFilter} onChange={(e) => setOrderIdFilter(e.target.value)} />
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No shipments yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Carrier</th>
                <th>Tracking</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{s.orderId.slice(0, 8)}…</td>
                  <td>
                    <span className={ui[badgeClass(s.status)]}>{s.status.replace("_", " ")}</span>
                  </td>
                  <td>{s.carrier ?? "—"}</td>
                  <td>
                    {s.trackingUrl && s.trackingNumber ? (
                      <a href={s.trackingUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary)" }}>
                        {s.trackingNumber}
                      </a>
                    ) : (
                      (s.trackingNumber ?? "—")
                    )}
                  </td>
                  <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setForm({
                            id: s.id,
                            orderId: s.orderId,
                            status: s.status,
                            carrier: s.carrier ?? "",
                            trackingNumber: s.trackingNumber ?? "",
                            trackingUrl: s.trackingUrl ?? "",
                          })
                        }
                      >
                        Edit
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
          title={form.id ? "Edit shipment" : "New shipment"}
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
            {!form.id && (
              <div className={ui.field}>
                <label className={ui.label}>Order id</label>
                <input className={ui.input} value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })} required autoFocus />
              </div>
            )}
            <div className={ui.field}>
              <label className={ui.label}>Status</label>
              <select className={ui.select} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ShipmentStatus })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Carrier</label>
              <input className={ui.input} value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} placeholder="Colissimo, DHL, ..." />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Tracking number</label>
              <input className={ui.input} value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Tracking URL</label>
              <input className={ui.input} value={form.trackingUrl} onChange={(e) => setForm({ ...form, trackingUrl: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
