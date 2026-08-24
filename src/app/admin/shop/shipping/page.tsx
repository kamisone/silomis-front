"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface Zone {
  id: string;
  name: string;
  countryCodes: string[];
  isActive: boolean;
  surchargeCents: number;
  freeShippingThresholdCents: number | null;
  estimatedDeliveryDays: string | null;
}

interface Method {
  id: string;
  zoneId: string;
  name: string;
  carrier: string | null;
  priceCents: number;
  freeAboveCents: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isActive: boolean;
  sortOrder: number;
  availableForFreeShipping: boolean;
}

interface ZoneForm {
  id: string | null;
  name: string;
  countryCodes: string;
  isActive: boolean;
  surchargeCents: string;
  freeShippingThresholdCents: string;
  estimatedDeliveryDays: string;
}

interface MethodForm {
  id: string | null;
  zoneId: string;
  name: string;
  carrier: string;
  priceCents: string;
  freeAboveCents: string;
  estimatedDaysMin: string;
  estimatedDaysMax: string;
  isActive: boolean;
  sortOrder: string;
  availableForFreeShipping: boolean;
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

const EMPTY_ZONE_FORM: ZoneForm = { id: null, name: "", countryCodes: "", isActive: true, surchargeCents: "0", freeShippingThresholdCents: "", estimatedDeliveryDays: "" };
const ZONE_FORM_ID = "shipping-zone-form";
const METHOD_FORM_ID = "shipping-method-form";

export default function ShippingPage() {
  const { toast } = useToast();
  const [zones, setZones] = useState<Zone[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoneForm, setZoneForm] = useState<ZoneForm | null>(null);
  const [methodForm, setMethodForm] = useState<MethodForm | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [z, m] = await Promise.all([api.get<Zone[]>("/next-api/admin/shop/shipping/zones"), api.get<Method[]>("/next-api/admin/shop/shipping/methods")]);
      setZones(z);
      setMethods(m);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function emptyMethodForm(): MethodForm {
    return {
      id: null,
      zoneId: zones[0]?.id ?? "",
      name: "",
      carrier: "",
      priceCents: "0",
      freeAboveCents: "",
      estimatedDaysMin: "2",
      estimatedDaysMax: "5",
      isActive: true,
      sortOrder: "0",
      availableForFreeShipping: false,
    };
  }

  async function handleZoneSubmit(e: FormEvent) {
    e.preventDefault();
    if (!zoneForm) return;
    setSaving(true);
    const isNew = !zoneForm.id;
    const payload = {
      name: zoneForm.name,
      countryCodes: zoneForm.countryCodes
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
      isActive: zoneForm.isActive,
      surchargeCents: parseInt(zoneForm.surchargeCents || "0", 10),
      freeShippingThresholdCents: zoneForm.freeShippingThresholdCents ? parseInt(zoneForm.freeShippingThresholdCents, 10) : null,
      estimatedDeliveryDays: zoneForm.estimatedDeliveryDays || null,
    };
    try {
      if (zoneForm.id) {
        await api.patch(`/next-api/admin/shop/shipping/zones/${zoneForm.id}`, payload);
      } else {
        await api.post("/next-api/admin/shop/shipping/zones", payload);
      }
      setZoneForm(null);
      await load();
      toast.success(isNew ? "Zone created" : "Zone updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to save zone") : "Failed to save zone");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteZone(zone: Zone) {
    if (!confirm(`Delete zone "${zone.name}"? Its methods will be deleted too.`)) return;
    try {
      await api.delete(`/next-api/admin/shop/shipping/zones/${zone.id}`);
      await load();
      toast.success("Zone deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to delete zone") : "Failed to delete zone");
    }
  }

  async function handleMethodSubmit(e: FormEvent) {
    e.preventDefault();
    if (!methodForm) return;
    setSaving(true);
    const isNew = !methodForm.id;
    const payload = {
      zoneId: methodForm.zoneId,
      name: methodForm.name,
      carrier: methodForm.carrier || null,
      priceCents: parseInt(methodForm.priceCents || "0", 10),
      freeAboveCents: methodForm.freeAboveCents ? parseInt(methodForm.freeAboveCents, 10) : null,
      estimatedDaysMin: parseInt(methodForm.estimatedDaysMin || "0", 10),
      estimatedDaysMax: parseInt(methodForm.estimatedDaysMax || "0", 10),
      isActive: methodForm.isActive,
      sortOrder: parseInt(methodForm.sortOrder || "0", 10),
      availableForFreeShipping: methodForm.availableForFreeShipping,
    };
    try {
      if (methodForm.id) {
        await api.patch(`/next-api/admin/shop/shipping/methods/${methodForm.id}`, payload);
      } else {
        await api.post("/next-api/admin/shop/shipping/methods", payload);
      }
      setMethodForm(null);
      await load();
      toast.success(isNew ? "Method created" : "Method updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to save method") : "Failed to save method");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMethod(method: Method) {
    if (!confirm(`Delete method "${method.name}"?`)) return;
    try {
      await api.delete(`/next-api/admin/shop/shipping/methods/${method.id}`);
      await load();
      toast.success("Method deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to delete method") : "Failed to delete method");
    }
  }

  function zoneName(zoneId: string): string {
    return zones.find((z) => z.id === zoneId)?.name ?? "—";
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Shipping zones</h1>
        <Button onClick={() => setZoneForm({ ...EMPTY_ZONE_FORM })}>New zone</Button>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : zones.length === 0 ? (
          <div className={ui.emptyState}>No shipping zones yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Countries</th>
                <th>Surcharge</th>
                <th>Free above</th>
                <th>Delivery</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id}>
                  <td>{z.name}</td>
                  <td>{z.countryCodes.length ? z.countryCodes.join(", ") : "Worldwide (fallback)"}</td>
                  <td>{eur(z.surchargeCents)}</td>
                  <td>{z.freeShippingThresholdCents !== null ? eur(z.freeShippingThresholdCents) : "—"}</td>
                  <td>{z.estimatedDeliveryDays ?? "—"}</td>
                  <td>
                    <span className={z.isActive ? ui.badgeActive : ui.badgeInactive}>{z.isActive ? "active" : "inactive"}</span>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setZoneForm({
                            id: z.id,
                            name: z.name,
                            countryCodes: z.countryCodes.join(", "),
                            isActive: z.isActive,
                            surchargeCents: String(z.surchargeCents),
                            freeShippingThresholdCents: z.freeShippingThresholdCents !== null ? String(z.freeShippingThresholdCents) : "",
                            estimatedDeliveryDays: z.estimatedDeliveryDays ?? "",
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => handleDeleteZone(z)}>
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

      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Shipping methods</h1>
        <Button onClick={() => setMethodForm(emptyMethodForm())} disabled={!zones.length}>
          New method
        </Button>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : methods.length === 0 ? (
          <div className={ui.emptyState}>No shipping methods yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Zone</th>
                <th>Carrier</th>
                <th>Price</th>
                <th>Free above</th>
                <th>Delivery (days)</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.name} {m.availableForFreeShipping && <span className={ui.badgeActive}>upgrade</span>}
                  </td>
                  <td>{zoneName(m.zoneId)}</td>
                  <td>{m.carrier ?? "—"}</td>
                  <td>{eur(m.priceCents)}</td>
                  <td>{m.freeAboveCents !== null ? eur(m.freeAboveCents) : "—"}</td>
                  <td>
                    {m.estimatedDaysMin}–{m.estimatedDaysMax}
                  </td>
                  <td>
                    <span className={m.isActive ? ui.badgeActive : ui.badgeInactive}>{m.isActive ? "active" : "inactive"}</span>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setMethodForm({
                            id: m.id,
                            zoneId: m.zoneId,
                            name: m.name,
                            carrier: m.carrier ?? "",
                            priceCents: String(m.priceCents),
                            freeAboveCents: m.freeAboveCents !== null ? String(m.freeAboveCents) : "",
                            estimatedDaysMin: String(m.estimatedDaysMin),
                            estimatedDaysMax: String(m.estimatedDaysMax),
                            isActive: m.isActive,
                            sortOrder: String(m.sortOrder),
                            availableForFreeShipping: m.availableForFreeShipping,
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => handleDeleteMethod(m)}>
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

      {zoneForm && (
        <Modal
          title={zoneForm.id ? "Edit zone" : "New zone"}
          onClose={() => setZoneForm(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setZoneForm(null)}>
                Cancel
              </Button>
              <Button type="submit" form={ZONE_FORM_ID} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <form id={ZONE_FORM_ID} onSubmit={handleZoneSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={ui.field}>
              <label className={ui.label}>Name</label>
              <input className={ui.input} value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} required autoFocus />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Country codes (comma-separated ISO codes, empty = worldwide fallback)</label>
              <input className={ui.input} value={zoneForm.countryCodes} onChange={(e) => setZoneForm({ ...zoneForm, countryCodes: e.target.value })} placeholder="FR, BE, LU" />
            </div>
            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Surcharge (cents)</label>
                <input className={ui.input} type="number" min={0} value={zoneForm.surchargeCents} onChange={(e) => setZoneForm({ ...zoneForm, surchargeCents: e.target.value })} />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Free-shipping threshold (cents, optional)</label>
                <input
                  className={ui.input}
                  type="number"
                  min={0}
                  value={zoneForm.freeShippingThresholdCents}
                  onChange={(e) => setZoneForm({ ...zoneForm, freeShippingThresholdCents: e.target.value })}
                />
              </div>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Estimated delivery (display string)</label>
              <input
                className={ui.input}
                value={zoneForm.estimatedDeliveryDays}
                onChange={(e) => setZoneForm({ ...zoneForm, estimatedDeliveryDays: e.target.value })}
                placeholder="3-7 business days"
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={zoneForm.isActive} onChange={(e) => setZoneForm({ ...zoneForm, isActive: e.target.checked })} />
              Active
            </label>
          </form>
        </Modal>
      )}

      {methodForm && (
        <Modal
          title={methodForm.id ? "Edit method" : "New method"}
          onClose={() => setMethodForm(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setMethodForm(null)}>
                Cancel
              </Button>
              <Button type="submit" form={METHOD_FORM_ID} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <form id={METHOD_FORM_ID} onSubmit={handleMethodSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={ui.field}>
              <label className={ui.label}>Zone</label>
              <select className={ui.select} value={methodForm.zoneId} onChange={(e) => setMethodForm({ ...methodForm, zoneId: e.target.value })} required>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Name</label>
              <input className={ui.input} value={methodForm.name} onChange={(e) => setMethodForm({ ...methodForm, name: e.target.value })} required />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Carrier (optional)</label>
              <input className={ui.input} value={methodForm.carrier} onChange={(e) => setMethodForm({ ...methodForm, carrier: e.target.value })} />
            </div>
            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Price (cents)</label>
                <input className={ui.input} type="number" min={0} value={methodForm.priceCents} onChange={(e) => setMethodForm({ ...methodForm, priceCents: e.target.value })} required />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Free above (cents, optional)</label>
                <input className={ui.input} type="number" min={0} value={methodForm.freeAboveCents} onChange={(e) => setMethodForm({ ...methodForm, freeAboveCents: e.target.value })} />
              </div>
            </div>
            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Est. days (min)</label>
                <input className={ui.input} type="number" min={0} value={methodForm.estimatedDaysMin} onChange={(e) => setMethodForm({ ...methodForm, estimatedDaysMin: e.target.value })} />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Est. days (max)</label>
                <input className={ui.input} type="number" min={0} value={methodForm.estimatedDaysMax} onChange={(e) => setMethodForm({ ...methodForm, estimatedDaysMax: e.target.value })} />
              </div>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Sort order</label>
              <input className={ui.input} type="number" value={methodForm.sortOrder} onChange={(e) => setMethodForm({ ...methodForm, sortOrder: e.target.value })} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={methodForm.isActive} onChange={(e) => setMethodForm({ ...methodForm, isActive: e.target.checked })} />
              Active
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input
                type="checkbox"
                checked={methodForm.availableForFreeShipping}
                onChange={(e) => setMethodForm({ ...methodForm, availableForFreeShipping: e.target.checked })}
              />
              Paid upgrade alongside free shipping (excluded from ordinary quoting)
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
}
