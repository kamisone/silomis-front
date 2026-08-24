"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import BilingualField from "@/components/admin/BilingualField";
import { useEntityTranslations, type OverlayLang } from "@/hooks/useEntityTranslations";
import { useSectionGenerate } from "@/hooks/useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import ui from "@/components/admin/ui/admin-ui.module.css";

const ENTITY_TYPE = "shop_country";
const TRANSLATION_FIELDS = ["name"];
const FORM_ID = "country-form";

const CONTINENTS = [
  { value: "EU", label: "Europe (EU)" },
  { value: "AF", label: "Africa (AF)" },
  { value: "AS", label: "Asia (AS)" },
  { value: "NA", label: "North America (NA)" },
  { value: "SA", label: "South America (SA)" },
  { value: "OC", label: "Oceania (OC)" },
  { value: "AN", label: "Antarctica (AN)" },
];

interface Country {
  isoCode: string;
  name: string;
  phonePrefix: string | null;
  currencyCode: string | null;
  isoCode3: string | null;
  continentCode: string | null;
  isActive: boolean;
  isShippingEnabled: boolean;
  isEuVat: boolean;
}

interface FormState {
  isoCode: string;
  isNew: boolean;
  name: string;
  phonePrefix: string;
  currencyCode: string;
  isoCode3: string;
  continentCode: string;
  isActive: boolean;
  isShippingEnabled: boolean;
  isEuVat: boolean;
}

const EMPTY_FORM: FormState = {
  isoCode: "",
  isNew: true,
  name: "",
  phonePrefix: "",
  currencyCode: "",
  isoCode3: "",
  continentCode: "",
  isActive: true,
  isShippingEnabled: false,
  isEuVat: false,
};

/** Self-contained flag glyph derived from the ISO code — no external flag assets needed. */
function flagEmoji(isoCode: string): string {
  return isoCode
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export default function CountriesPage() {
  const { toast } = useToast();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const { translations, setTranslation, saveTranslations } = useEntityTranslations(ENTITY_TYPE, form && !form.isNew ? form.isoCode : null);
  const nameGen = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/countries/sections/name/translate");

  async function generateName() {
    if (!form || !form.name.trim()) return;
    const outcome = await nameGen.generate({ text: form.name });
    if (!outcome) return;
    for (const [lang, value] of Object.entries(outcome.result) as [OverlayLang, string][]) {
      if (value) setTranslation(lang, "name", value);
    }
    const errorSummary = summarizeGenerateErrors(outcome.errors);
    if (errorSummary) nameGen.setError(errorSummary);
  }

  async function load() {
    setLoading(true);
    try {
      setCountries(await api.get<Country[]>("/next-api/admin/shop/countries"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(c: Country) {
    setForm({
      isoCode: c.isoCode,
      isNew: false,
      name: c.name,
      phonePrefix: c.phonePrefix ?? "",
      currencyCode: c.currencyCode ?? "",
      isoCode3: c.isoCode3 ?? "",
      continentCode: c.continentCode ?? "",
      isActive: c.isActive,
      isShippingEnabled: c.isShippingEnabled,
      isEuVat: c.isEuVat,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.isoCode.trim() || !form.name.trim()) {
      toast.error("ISO code and name are required");
      return;
    }
    setSaving(true);
    const isoCode = form.isoCode.toUpperCase().trim();
    const payload = {
      isoCode,
      name: form.name,
      phonePrefix: form.phonePrefix || null,
      currencyCode: form.currencyCode.toUpperCase().trim() || null,
      isoCode3: form.isoCode3.toUpperCase().trim() || null,
      continentCode: form.continentCode || null,
      isActive: form.isActive,
      isShippingEnabled: form.isShippingEnabled,
      isEuVat: form.isEuVat,
    };
    try {
      if (form.isNew) await api.post("/next-api/admin/shop/countries", payload);
      else await api.patch(`/next-api/admin/shop/countries/${isoCode}`, payload);
      await saveTranslations(isoCode, TRANSLATION_FIELDS);
      const isNew = form.isNew;
      setForm(null);
      await load();
      toast.success(isNew ? "Country added" : "Country updated");
    } catch (err) {
      toast.error(errMessage(err, "Failed to save country"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Country) {
    if (!confirm(`Delete "${c.name}" (${c.isoCode})? This cannot be undone.`)) return;
    setUpdating(`${c.isoCode}delete`);
    try {
      await api.delete(`/next-api/admin/shop/countries/${c.isoCode}`);
      await load();
      toast.success("Country deleted");
    } catch (err) {
      toast.error(errMessage(err, "Failed to delete country"));
    } finally {
      setUpdating(null);
    }
  }

  async function toggle(isoCode: string, field: "isActive" | "isShippingEnabled", current: boolean) {
    setUpdating(isoCode + field);
    try {
      const updated = await api.patch<Country>(`/next-api/admin/shop/countries/${isoCode}`, { [field]: !current });
      setCountries((prev) => prev.map((c) => (c.isoCode === isoCode ? updated : c)));
    } catch (err) {
      toast.error(errMessage(err, "Failed to update country"));
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Countries {countries.length > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({countries.length})</span>}</h1>
        <Button onClick={openCreate}>New country</Button>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : countries.length === 0 ? (
          <div className={ui.emptyState}>No countries yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>ISO</th>
                <th>Currency</th>
                <th>EU VAT</th>
                <th>Shipping</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {countries.map((c) => (
                <tr key={c.isoCode}>
                  <td style={{ fontSize: "1.1rem" }}>{flagEmoji(c.isoCode)}</td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ fontFamily: "monospace" }}>{c.isoCode}</td>
                  <td>{c.currencyCode ?? "—"}</td>
                  <td>{c.isEuVat ? <span className={ui.badgeActive}>EU VAT</span> : "—"}</td>
                  <td>
                    <button type="button" disabled={!!updating} className={c.isShippingEnabled ? ui.badgeActive : ui.badgeInactive} style={{ border: "none", cursor: "pointer" }} onClick={() => toggle(c.isoCode, "isShippingEnabled", c.isShippingEnabled)}>
                      {c.isShippingEnabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td>
                    <button type="button" disabled={!!updating} className={c.isActive ? ui.badgeActive : ui.badgeInactive} style={{ border: "none", cursor: "pointer" }} onClick={() => toggle(c.isoCode, "isActive", c.isActive)}>
                      {c.isActive ? "Active" : "Hidden"}
                    </button>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button variant="secondary" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                      <Button variant="danger" disabled={updating === `${c.isoCode}delete`} onClick={() => handleDelete(c)}>
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
          title={form.isNew ? "New country" : `Edit — ${form.name}`}
          onClose={() => setForm(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} disabled={saving || !form.isoCode.trim() || !form.name.trim()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <form id={FORM_ID} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>ISO code (2-letter) *</label>
                <input
                  className={ui.input}
                  value={form.isoCode}
                  maxLength={2}
                  placeholder="FR"
                  disabled={!form.isNew}
                  onChange={(e) => setForm({ ...form, isoCode: e.target.value.toUpperCase() })}
                  required
                  autoFocus
                />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>ISO code (3-letter)</label>
                <input className={ui.input} value={form.isoCode3} maxLength={3} placeholder="FRA" onChange={(e) => setForm({ ...form, isoCode3: e.target.value.toUpperCase() })} />
              </div>
            </div>

            <BilingualField label="Name" field="name" baseValue={form.name} baseOnChange={(v) => setForm({ ...form, name: v })} baseRequired translations={translations} onTranslationChange={setTranslation} onGenerate={generateName} generating={nameGen.generating} generateError={nameGen.error} />

            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Phone prefix</label>
                <input className={ui.input} value={form.phonePrefix} maxLength={10} placeholder="+33" onChange={(e) => setForm({ ...form, phonePrefix: e.target.value })} />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Currency (ISO 4217)</label>
                <input className={ui.input} value={form.currencyCode} maxLength={3} placeholder="EUR" onChange={(e) => setForm({ ...form, currencyCode: e.target.value.toUpperCase() })} />
              </div>
            </div>

            <div className={ui.field}>
              <label className={ui.label}>Continent</label>
              <select className={ui.select} value={form.continentCode} onChange={(e) => setForm({ ...form, continentCode: e.target.value })}>
                <option value="">— Select —</option>
                {CONTINENTS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active (shown in checkout)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                <input type="checkbox" checked={form.isShippingEnabled} onChange={(e) => setForm({ ...form, isShippingEnabled: e.target.checked })} />
                Shipping enabled
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                <input type="checkbox" checked={form.isEuVat} onChange={(e) => setForm({ ...form, isEuVat: e.target.checked })} />
                EU VAT zone
              </label>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
