"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";
import BilingualField from "@/components/admin/BilingualField";
import { useEntityTranslations, type OverlayLang } from "@/hooks/useEntityTranslations";
import { useSectionGenerate } from "@/hooks/useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import { useToast } from "@/components/toast/ToastContext";
import styles from "./VariantAttributes.module.css";

interface OptionValue {
  id: string;
  value: string;
  displayValue: string | null;
  swatchValue: string | null;
  swatchType: "color" | "image" | null;
  priceAdjustmentCents: number | null;
  sortOrder: number;
  isActive: boolean;
}

interface VariantAttribute {
  id: string;
  name: string;
  slug: string;
  adminLabel: string | null;
  displayType: "swatch" | "button" | "dropdown";
  sortOrder: number;
  isActive: boolean;
  optionValues: OptionValue[];
}

interface AttrFormState {
  id: string | null;
  name: string;
  slug: string;
  adminLabel: string;
  displayType: "swatch" | "button" | "dropdown";
  sortOrder: number;
  isActive: boolean;
}

interface ValueFormState {
  attributeId: string;
  id: string | null;
  value: string;
  displayValue: string;
  swatchValue: string;
  swatchType: "" | "color" | "image";
  priceAdjustmentCents: string;
  sortOrder: number;
  isActive: boolean;
}

const ATTR_FORM_ID = "attribute-form";
const VALUE_FORM_ID = "value-form";

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export default function VariantAttributesPage() {
  const { toast } = useToast();
  const [attributes, setAttributes] = useState<VariantAttribute[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attrForm, setAttrForm] = useState<AttrFormState | null>(null);
  const [valueForm, setValueForm] = useState<ValueFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const { translations: attrTr, setTranslation: setAttrTr, saveTranslations: saveAttrTr } =
    useEntityTranslations("shop_variant_attribute", attrForm?.id ?? null);
  const { translations: valTr, setTranslation: setValTr, saveTranslations: saveValTr } =
    useEntityTranslations("shop_variation_option", valueForm?.id ?? null);

  const nameGen = useSectionGenerate<SectionTranslationOutcome<string>>(
    "/next-api/admin/shop/variant-attributes/sections/name/translate",
  );
  const displayValueGen = useSectionGenerate<SectionTranslationOutcome<string>>(
    "/next-api/admin/shop/variant-attributes/sections/display-value/translate",
  );

  async function generateAttrName() {
    if (!attrForm) return;
    const outcome = await nameGen.generate({ text: attrForm.name });
    if (!outcome) return;
    for (const [lang, value] of Object.entries(outcome.result) as [OverlayLang, string][]) {
      if (value) setAttrTr(lang, "name", value);
    }
    const errorSummary = summarizeGenerateErrors(outcome.errors);
    if (errorSummary) nameGen.setError(errorSummary);
  }

  async function generateDisplayValue() {
    if (!valueForm) return;
    const outcome = await displayValueGen.generate({ text: valueForm.displayValue });
    if (!outcome) return;
    for (const [lang, value] of Object.entries(outcome.result) as [OverlayLang, string][]) {
      if (value) setValTr(lang, "displayValue", value);
    }
    const errorSummary = summarizeGenerateErrors(outcome.errors);
    if (errorSummary) displayValueGen.setError(errorSummary);
  }

  async function load() {
    setLoading(true);
    try {
      setAttributes(await api.get<VariantAttribute[]>("/next-api/admin/shop/variant-attributes"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAttrSubmit(e: FormEvent) {
    e.preventDefault();
    if (!attrForm) return;
    setSaving(true);
    const payload = {
      name: attrForm.name,
      slug: attrForm.slug || undefined,
      adminLabel: attrForm.adminLabel || null,
      displayType: attrForm.displayType,
      sortOrder: attrForm.sortOrder,
      isActive: attrForm.isActive,
    };
    try {
      let entityId = attrForm.id;
      if (attrForm.id) {
        await api.patch(`/next-api/admin/shop/variant-attributes/${attrForm.id}`, payload);
      } else {
        const created = await api.post<VariantAttribute>("/next-api/admin/shop/variant-attributes", payload);
        entityId = created.id;
      }
      if (entityId) await saveAttrTr(entityId, ["name"]);
      toast.success(attrForm.id ? "Attribute updated" : "Attribute created");
      setAttrForm(null);
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to save attribute"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAttr(attr: VariantAttribute) {
    if (!confirm(`Delete attribute "${attr.name}"? This also removes its option values.`)) return;
    try {
      await api.delete(`/next-api/admin/shop/variant-attributes/${attr.id}`);
      toast.success("Attribute deleted");
      setExpanded((e) => (e === attr.id ? null : e));
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to delete attribute"));
    }
  }

  async function handleValueSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valueForm) return;
    setSaving(true);
    const payload = {
      value: valueForm.value,
      displayValue: valueForm.displayValue || null,
      swatchValue: valueForm.swatchValue || null,
      swatchType: valueForm.swatchType || null,
      priceAdjustmentCents: valueForm.priceAdjustmentCents === "" ? null : Math.round(Number(valueForm.priceAdjustmentCents) * 100),
      sortOrder: valueForm.sortOrder,
      isActive: valueForm.isActive,
    };
    try {
      let entityId = valueForm.id;
      if (valueForm.id) {
        await api.patch(`/next-api/admin/shop/variant-attributes/${valueForm.attributeId}/values/${valueForm.id}`, payload);
      } else {
        const created = await api.post<OptionValue>(`/next-api/admin/shop/variant-attributes/${valueForm.attributeId}/values`, payload);
        entityId = created.id;
      }
      if (entityId) await saveValTr(entityId, ["displayValue"]);
      toast.success(valueForm.id ? "Value updated" : "Value added");
      setValueForm(null);
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to save value"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteValue(attributeId: string, value: OptionValue) {
    if (!confirm(`Delete value "${value.value}"?`)) return;
    try {
      await api.delete(`/next-api/admin/shop/variant-attributes/${attributeId}/values/${value.id}`);
      toast.success("Value deleted");
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to delete value"));
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Variant attributes</h1>
        <Button
          onClick={() =>
            setAttrForm({ id: null, name: "", slug: "", adminLabel: "", displayType: "button", sortOrder: 0, isActive: true })
          }
        >
          New attribute
        </Button>
      </div>

      {loading ? (
        <div className={ui.card}>
          <div className={ui.emptyState}>Loading…</div>
        </div>
      ) : attributes.length === 0 ? (
        <div className={ui.card}>
          <div className={ui.emptyState}>No variant attributes yet — create one (e.g. Color, Size) to start building variants.</div>
        </div>
      ) : (
        attributes.map((attr) => {
          const isOpen = expanded === attr.id;
          const toggle = () => setExpanded((e) => (e === attr.id ? null : attr.id));
          return (
          <div key={attr.id} className={ui.card}>
            <div
              className={`${styles.attrHeader} ${isOpen ? styles.attrHeaderOpen : ""}`}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={toggle}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle();
                }
              }}
            >
              <div className={styles.attrHeaderMain}>
                <span
                  className={`${styles.expandBtn} ${isOpen ? styles.expandBtnActive : ""}`}
                  title={isOpen ? "Collapse" : "Expand values"}
                  aria-hidden="true"
                >
                  <ChevronDown size={14} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} />
                </span>
                <strong className={styles.attrName}>{attr.name}</strong>
                <span className={styles.valueCount} title={`${attr.optionValues.length} option value(s)`}>
                  {attr.optionValues.length}
                </span>
                <span className={ui.badge}>{attr.displayType}</span>
                <span className={ui.badge}>Order: {attr.sortOrder}</span>
                <span className={attr.isActive ? ui.badgeActive : ui.badgeInactive}>{attr.isActive ? "active" : "inactive"}</span>
              </div>
              <div className={ui.rowActions} onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setAttrForm({
                      id: attr.id,
                      name: attr.name,
                      slug: attr.slug,
                      adminLabel: attr.adminLabel ?? "",
                      displayType: attr.displayType,
                      sortOrder: attr.sortOrder,
                      isActive: attr.isActive,
                    })
                  }
                >
                  Edit
                </Button>
                <Button variant="danger" onClick={() => handleDeleteAttr(attr)}>
                  Delete
                </Button>
              </div>
            </div>

            {isOpen && (
              <div className={styles.valuesPanel}>
                <div className={styles.valuesPanelHeader}>
                  <span className={styles.valuesPanelTitle}>Option values — {attr.name}</span>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setValueForm({
                        attributeId: attr.id,
                        id: null,
                        value: "",
                        displayValue: "",
                        swatchValue: "",
                        swatchType: "",
                        priceAdjustmentCents: "",
                        sortOrder: 0,
                        isActive: true,
                      })
                    }
                  >
                    Add value
                  </Button>
                </div>

                {attr.optionValues.length === 0 ? (
                  <p className={styles.valEmpty}>No option values yet. Add one to enable structured variant selection.</p>
                ) : (
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>Value</th>
                      <th>Display</th>
                      <th>Swatch</th>
                      <th>Price adj.</th>
                      <th>Order</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {attr.optionValues.map((v) => (
                      <tr key={v.id}>
                        <td>{v.value}</td>
                        <td>{v.displayValue ?? "—"}</td>
                        <td>
                          {v.swatchType === "color" && v.swatchValue ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                              <span style={{ width: 16, height: 16, borderRadius: "50%", background: v.swatchValue, border: "1px solid var(--color-surface)", display: "inline-block" }} />
                              {v.swatchValue}
                            </span>
                          ) : v.swatchType === "image" && v.swatchValue ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                              <span
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 4,
                                  backgroundImage: `url(${v.swatchValue})`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "center",
                                  border: "1px solid var(--color-surface)",
                                  display: "inline-block",
                                }}
                                title={v.swatchValue}
                              />
                              {v.swatchValue}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{v.priceAdjustmentCents != null ? `${v.priceAdjustmentCents >= 0 ? "+" : ""}${(v.priceAdjustmentCents / 100).toFixed(2)}` : "—"}</td>
                        <td>{v.sortOrder}</td>
                        <td>
                          <span className={v.isActive ? ui.badgeActive : ui.badgeInactive}>{v.isActive ? "active" : "inactive"}</span>
                        </td>
                        <td>
                          <div className={ui.rowActions}>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                setValueForm({
                                  attributeId: attr.id,
                                  id: v.id,
                                  value: v.value,
                                  displayValue: v.displayValue ?? "",
                                  swatchValue: v.swatchValue ?? "",
                                  swatchType: v.swatchType ?? "",
                                  priceAdjustmentCents: v.priceAdjustmentCents != null ? String(v.priceAdjustmentCents / 100) : "",
                                  sortOrder: v.sortOrder,
                                  isActive: v.isActive,
                                })
                              }
                            >
                              Edit
                            </Button>
                            <Button variant="danger" onClick={() => handleDeleteValue(attr.id, v)}>
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
            )}
          </div>
          );
        })
      )}

      {attrForm && (
        <Modal
          title={attrForm.id ? "Edit attribute" : "New attribute"}
          onClose={() => setAttrForm(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setAttrForm(null)}>
                Cancel
              </Button>
              <Button type="submit" form={ATTR_FORM_ID} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <form id={ATTR_FORM_ID} onSubmit={handleAttrSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <BilingualField
              label="Name"
              field="name"
              baseValue={attrForm.name}
              baseOnChange={(v) => setAttrForm({ ...attrForm, name: v })}
              basePlaceholder="e.g. Color"
              baseRequired
              translations={attrTr}
              onTranslationChange={setAttrTr}
              overlayPlaceholder="e.g. Couleur, Taille"
              onGenerate={generateAttrName}
              generating={nameGen.generating}
              generateError={nameGen.error}
            />
            <div className={ui.field}>
              <label className={ui.label}>Slug (optional)</label>
              <input className={ui.input} value={attrForm.slug} onChange={(e) => setAttrForm({ ...attrForm, slug: e.target.value })} placeholder="auto-generated from name" />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Display type</label>
              <select
                className={ui.select}
                value={attrForm.displayType}
                onChange={(e) => setAttrForm({ ...attrForm, displayType: e.target.value as AttrFormState["displayType"] })}
              >
                <option value="button">Button</option>
                <option value="swatch">Swatch</option>
                <option value="dropdown">Dropdown</option>
              </select>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Internal label (optional)</label>
              <input
                className={ui.input}
                value={attrForm.adminLabel}
                onChange={(e) => setAttrForm({ ...attrForm, adminLabel: e.target.value })}
                placeholder="Distinguishes attributes sharing the same storefront name"
              />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Sort order</label>
              <input
                className={ui.input}
                type="number"
                min={0}
                value={attrForm.sortOrder}
                onChange={(e) => setAttrForm({ ...attrForm, sortOrder: Number(e.target.value) })}
              />
              <span className={ui.muted} style={{ fontSize: "0.8rem" }}>Lower numbers appear first</span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={attrForm.isActive} onChange={(e) => setAttrForm({ ...attrForm, isActive: e.target.checked })} />
              Active
            </label>
          </form>
        </Modal>
      )}

      {valueForm && (
        <Modal
          title={valueForm.id ? "Edit option value" : "Add option value"}
          onClose={() => setValueForm(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setValueForm(null)}>
                Cancel
              </Button>
              <Button type="submit" form={VALUE_FORM_ID} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <form id={VALUE_FORM_ID} onSubmit={handleValueSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={ui.field}>
              <label className={ui.label}>Value</label>
              <input className={ui.input} value={valueForm.value} onChange={(e) => setValueForm({ ...valueForm, value: e.target.value })} required autoFocus placeholder="e.g. Black" />
            </div>
            <BilingualField
              label="Display value (optional)"
              field="displayValue"
              baseValue={valueForm.displayValue}
              baseOnChange={(v) => setValueForm({ ...valueForm, displayValue: v })}
              translations={valTr}
              onTranslationChange={setValTr}
              overlayPlaceholder="Noir"
              onGenerate={generateDisplayValue}
              generating={displayValueGen.generating}
              generateError={displayValueGen.error}
            />
            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Swatch type</label>
                <select
                  className={ui.select}
                  value={valueForm.swatchType}
                  onChange={(e) => setValueForm({ ...valueForm, swatchType: e.target.value as ValueFormState["swatchType"] })}
                >
                  <option value="">None</option>
                  <option value="color">Color</option>
                  <option value="image">Image key</option>
                </select>
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Swatch value</label>
                <input
                  className={ui.input}
                  value={valueForm.swatchValue}
                  onChange={(e) => setValueForm({ ...valueForm, swatchValue: e.target.value })}
                  placeholder={valueForm.swatchType === "color" ? "#000000" : "media storage key"}
                />
              </div>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Price adjustment (€, optional)</label>
              <input
                className={ui.input}
                type="number"
                step="0.01"
                value={valueForm.priceAdjustmentCents}
                onChange={(e) => setValueForm({ ...valueForm, priceAdjustmentCents: e.target.value })}
                placeholder="e.g. 5 or -2"
              />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Sort order</label>
              <input
                className={ui.input}
                type="number"
                min={0}
                value={valueForm.sortOrder}
                onChange={(e) => setValueForm({ ...valueForm, sortOrder: Number(e.target.value) })}
              />
              <span className={ui.muted} style={{ fontSize: "0.8rem" }}>Lower numbers appear first</span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={valueForm.isActive} onChange={(e) => setValueForm({ ...valueForm, isActive: e.target.checked })} />
              Active
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
}
