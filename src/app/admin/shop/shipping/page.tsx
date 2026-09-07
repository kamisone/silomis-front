"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import EntityPicker, { type PickerOption } from "@/components/admin/ui/EntityPicker";
import ui from "@/components/admin/ui/admin-ui.module.css";

/** The shipping-enabled subset of admin/shop/countries — a zone can only
 *  serve somewhere that exists in the catalogue of countries. */
interface Country {
  isoCode: string;
  name: string;
  isActive: boolean;
  isShippingEnabled: boolean;
}

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
  code: string | null;
  name: string;
  carrier: string | null;
  priceCents: number;
  freeAboveCents: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isActive: boolean;
  sortOrder: number;
  availableForFreeShipping: boolean;
  requiresProductOptIn: boolean;
  requiresPickupPoint: boolean;
  supportedCountryCodes: string[];
  carrierCode: string | null;
}

interface ZoneForm {
  id: string | null;
  name: string;
  countryCodes: string[];
  isActive: boolean;
  /** Euros, as typed. Converted to cents on submit — see `toCents`. */
  surcharge: string;
  freeShippingThreshold: string;
  estimatedDeliveryDays: string;
}

interface MethodForm {
  id: string | null;
  zoneId: string;
  code: string;
  name: string;
  carrier: string;
  /** Euros, as typed. Converted to cents on submit — see `toCents`. */
  price: string;
  freeAbove: string;
  estimatedDaysMin: string;
  estimatedDaysMax: string;
  isActive: boolean;
  sortOrder: string;
  availableForFreeShipping: boolean;
  requiresProductOptIn: boolean;
  requiresPickupPoint: boolean;
  supportedCountryCodes: string[];
  carrierCode: string;
}

/**
 * Money crosses the API in cents and is typed in euros, so every amount is
 * converted at the form's edges — read in through `eur`, written back through
 * `toCents`. Same trio of helpers as the products and categories pages.
 */
function euroLabel(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}
function eur(cents: number | null): string {
  return cents === null || cents === undefined ? "" : String(cents / 100);
}
function toCents(v: string): number | null {
  return v.trim() === "" ? null : Math.round(Number(v) * 100);
}

const EMPTY_ZONE_FORM: ZoneForm = { id: null, name: "", countryCodes: [], isActive: true, surcharge: "0", freeShippingThreshold: "", estimatedDeliveryDays: "" };
const ZONE_FORM_ID = "shipping-zone-form";
const METHOD_FORM_ID = "shipping-method-form";

/**
 * The countries the pickers offer, name first with the ISO code beneath.
 *
 * A country that exists but is not shipping-enabled is still listed, marked as
 * such rather than hidden: a zone is often drawn up before the country is
 * switched on, and silently omitting it looks like the country is missing.
 * One already saved on a zone is kept in the list too — see `extra` — so a
 * later change in admin/shop/countries can never make a saved code vanish
 * from the form without a word.
 */
function countryOptions(countries: Country[], extra: string[]): PickerOption[] {
  const known = new Set(countries.map((c) => c.isoCode));
  const options: PickerOption[] = countries.map((c) => ({
    id: c.isoCode,
    label: c.name,
    chipLabel: `${flagEmoji(c.isoCode)} ${c.isoCode}`,
    sublabel: c.isShippingEnabled ? c.isoCode : `${c.isoCode} · shipping off`,
  }));
  for (const code of extra) {
    if (!known.has(code)) {
      options.push({ id: code, label: code, chipLabel: `${flagEmoji(code)} ${code}`, sublabel: "No longer in your countries list" });
    }
  }
  return options;
}

/**
 * "FR" → 🇫🇷. An ISO 3166-1 alpha-2 code maps onto the flag by shifting each
 * letter into its regional-indicator symbol, so no flag assets or lookup table
 * are needed. A code that isn't two ASCII letters is returned unchanged rather
 * than turned into stray symbols.
 */
function flagEmoji(isoCode: string): string {
  const code = isoCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return isoCode;
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default function ShippingPage() {
  const { toast } = useToast();
  const [zones, setZones] = useState<Zone[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoneForm, setZoneForm] = useState<ZoneForm | null>(null);
  const [methodForm, setMethodForm] = useState<MethodForm | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [z, m, c] = await Promise.all([
        api.get<Zone[]>("/next-api/admin/shop/shipping/zones"),
        api.get<Method[]>("/next-api/admin/shop/shipping/methods"),
        api.get<Country[]>("/next-api/admin/shop/countries"),
      ]);
      setZones(z);
      setMethods(m);
      setCountries(c);
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
      code: "",
      name: "",
      carrier: "",
      price: "0",
      freeAbove: "",
      estimatedDaysMin: "2",
      estimatedDaysMax: "5",
      isActive: true,
      sortOrder: "0",
      availableForFreeShipping: false,
      requiresProductOptIn: false,
      requiresPickupPoint: false,
      supportedCountryCodes: [],
      carrierCode: "",
    };
  }

  async function handleZoneSubmit(e: FormEvent) {
    e.preventDefault();
    if (!zoneForm) return;
    setSaving(true);
    const isNew = !zoneForm.id;
    const payload = {
      name: zoneForm.name,
      countryCodes: zoneForm.countryCodes,
      isActive: zoneForm.isActive,
      surchargeCents: toCents(zoneForm.surcharge) ?? 0,
      freeShippingThresholdCents: toCents(zoneForm.freeShippingThreshold),
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
      code: methodForm.code.trim() || null,
      name: methodForm.name,
      carrier: methodForm.carrier || null,
      priceCents: toCents(methodForm.price) ?? 0,
      freeAboveCents: toCents(methodForm.freeAbove),
      estimatedDaysMin: parseInt(methodForm.estimatedDaysMin || "0", 10),
      estimatedDaysMax: parseInt(methodForm.estimatedDaysMax || "0", 10),
      isActive: methodForm.isActive,
      sortOrder: parseInt(methodForm.sortOrder || "0", 10),
      availableForFreeShipping: methodForm.availableForFreeShipping,
      requiresProductOptIn: methodForm.requiresProductOptIn,
      requiresPickupPoint: methodForm.requiresPickupPoint,
      carrierCode: methodForm.carrierCode.trim() || null,
      supportedCountryCodes: methodForm.supportedCountryCodes,
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
                  <td>{euroLabel(z.surchargeCents)}</td>
                  <td>{z.freeShippingThresholdCents !== null ? euroLabel(z.freeShippingThresholdCents) : "—"}</td>
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
                            countryCodes: z.countryCodes,
                            isActive: z.isActive,
                            surcharge: eur(z.surchargeCents),
                            freeShippingThreshold: eur(z.freeShippingThresholdCents),
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
                    {/* Neutral, not green: these describe how the method behaves,
                        not whether it is switched on — the active/inactive badge
                        in the status column is the one that says that. */}
                    {m.requiresPickupPoint && <span className={ui.badge}>pickup point</span>}
                    {m.requiresProductOptIn && <span className={ui.badge}>per-product</span>}
                  </td>
                  <td>{zoneName(m.zoneId)}</td>
                  <td>{m.carrier ?? "—"}</td>
                  <td>{euroLabel(m.priceCents)}</td>
                  <td>{m.freeAboveCents !== null ? euroLabel(m.freeAboveCents) : "—"}</td>
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
                            price: eur(m.priceCents),
                            freeAbove: eur(m.freeAboveCents),
                            estimatedDaysMin: String(m.estimatedDaysMin),
                            estimatedDaysMax: String(m.estimatedDaysMax),
                            isActive: m.isActive,
                            sortOrder: String(m.sortOrder),
                            availableForFreeShipping: m.availableForFreeShipping,
                            code: m.code ?? "",
                            requiresProductOptIn: m.requiresProductOptIn,
                            requiresPickupPoint: m.requiresPickupPoint,
                            supportedCountryCodes: m.supportedCountryCodes ?? [],
                            carrierCode: m.carrierCode ?? "",
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
              <EntityPicker
                label="Countries"
                hint="Picked from the countries you have set up. Leave empty to make this the worldwide fallback zone."
                options={countryOptions(countries, zoneForm.countryCodes)}
                value={zoneForm.countryCodes}
                onChange={(countryCodes) => setZoneForm({ ...zoneForm, countryCodes })}
                placeholder="Search countries…"
                emptyLabel="No countries picked — this zone is the worldwide fallback."
                reorderable={false}
                chips
                disabled={saving}
              />
            </div>
            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Surcharge (€)</label>
                <input
                  className={ui.input}
                  type="number"
                  step="0.01"
                  min={0}
                  value={zoneForm.surcharge}
                  onChange={(e) => setZoneForm({ ...zoneForm, surcharge: e.target.value })}
                />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Free-shipping threshold (€, optional)</label>
                <input
                  className={ui.input}
                  type="number"
                  min={0}
                  value={zoneForm.freeShippingThreshold}
                  onChange={(e) => setZoneForm({ ...zoneForm, freeShippingThreshold: e.target.value })}
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
                <label className={ui.label}>Price (€)</label>
                <input
                  className={ui.input}
                  type="number"
                  step="0.01"
                  min={0}
                  value={methodForm.price}
                  onChange={(e) => setMethodForm({ ...methodForm, price: e.target.value })}
                  required
                />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Free above (€, optional)</label>
                <input
                  className={ui.input}
                  type="number"
                  step="0.01"
                  min={0}
                  value={methodForm.freeAbove}
                  onChange={(e) => setMethodForm({ ...methodForm, freeAbove: e.target.value })}
                />
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
              <EntityPicker
                label="Countries served"
                hint="Narrows this method to part of its zone. Leave empty and it serves the whole zone."
                options={countryOptions(countries, methodForm.supportedCountryCodes)}
                value={methodForm.supportedCountryCodes}
                onChange={(supportedCountryCodes) => setMethodForm({ ...methodForm, supportedCountryCodes })}
                placeholder="Search countries…"
                emptyLabel="No countries picked — serves the whole zone."
                reorderable={false}
                chips
                disabled={saving}
              />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Carrier code</label>
              <input
                className={ui.input}
                value={methodForm.carrierCode}
                onChange={(e) => setMethodForm({ ...methodForm, carrierCode: e.target.value })}
                placeholder="mondial_relay, colissimo — filters which pickup points are offered"
              />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Internal code</label>
              <input
                className={ui.input}
                value={methodForm.code}
                onChange={(e) => setMethodForm({ ...methodForm, code: e.target.value })}
                placeholder="mondial_relay — optional, lower-case, must be unique"
              />
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
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input
                type="checkbox"
                checked={methodForm.requiresProductOptIn}
                onChange={(e) => setMethodForm({ ...methodForm, requiresProductOptIn: e.target.checked })}
              />
              Enabled per product (offered only when every product in the basket allows it)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input
                type="checkbox"
                checked={methodForm.requiresPickupPoint}
                onChange={(e) => setMethodForm({ ...methodForm, requiresPickupPoint: e.target.checked })}
              />
              Customer must choose a pickup point before paying
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
}
