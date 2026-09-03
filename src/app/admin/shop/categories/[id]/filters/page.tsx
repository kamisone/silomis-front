"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import Switch from "@/components/admin/ui/Switch";
import BilingualField from "@/components/admin/BilingualField";
import { useEntityTranslations, OVERLAY_LANGS, type OverlayLang } from "@/hooks/useEntityTranslations";
import { useSectionGenerate } from "@/hooks/useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import { useToast } from "@/components/toast/ToastContext";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./CategoryFilters.module.css";

const FILTER_ENTITY_TYPE = "shop_category_filter";
const VALUE_ENTITY_TYPE = "shop_category_filter_value";
const FILTER_FORM_ID = "category-filter-form";
const VALUE_FORM_ID = "category-filter-value-form";

interface FilterValue {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  isDefault: boolean;
}

interface CategoryFilter {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  values: FilterValue[];
}

interface CategoryLite {
  id: string;
  name: string;
}

/** One value row inside the "new filter" modal — a filter needs at least one
 *  value to have anything to default to, so unlike a variant attribute's
 *  values (added one at a time after creation), these are collected up front.
 *  Each still gets the full bilingual treatment: `translations` mirrors
 *  useEntityTranslations' own shape so it can go straight into a
 *  BilingualField, then gets saved for real once the value has an id. */
interface DraftValue {
  key: string;
  value: string;
  label: string;
  translations: Record<OverlayLang, Record<string, string>>;
}

function emptyDraftTranslations(): Record<OverlayLang, Record<string, string>> {
  return Object.fromEntries(OVERLAY_LANGS.map((l) => [l, {}])) as Record<OverlayLang, Record<string, string>>;
}

interface FilterFormState {
  id: string | null;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  /** Only read when creating (id === null) — an existing filter's values are
   *  managed one at a time in its own values panel below. */
  draftValues: DraftValue[];
  defaultDraftKey: string;
}

interface ValueFormState {
  filterId: string;
  id: string | null;
  value: string;
  label: string;
  sortOrder: number;
  isDefault: boolean;
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

function newDraftValue(): DraftValue {
  return { key: crypto.randomUUID(), value: "", label: "", translations: emptyDraftTranslations() };
}

/** Bulk-upserts translation rows for one already-created entity — the same
 *  request useEntityTranslations' own saveTranslations sends, but usable for
 *  several independent entities (one per draft value) instead of the single
 *  one that hook tracks. Nothing to delete here: these are freshly created
 *  rows with no prior translations to clean up. */
async function saveTranslationsFor(
  entityType: string,
  entityId: string,
  translations: Record<OverlayLang, Record<string, string>>,
  fields: string[],
): Promise<void> {
  const items = OVERLAY_LANGS.flatMap((lang) =>
    fields
      .filter((f) => translations[lang]?.[f]?.trim())
      .map((f) => ({ entityType, entityId, field: f, lang, value: translations[lang][f].trim() })),
  );
  if (items.length === 0) return;
  await fetch("/next-api/translations/bulk", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

/**
 * One draft value row inside the "new filter" modal. A real (if small)
 * component rather than an inline `.map()` body: it needs its own
 * `useSectionGenerate` instance so one row generating doesn't show every
 * other row's button as busy too — hooks can't be called a variable number
 * of times inside a loop, only once per component instance.
 */
function DraftValueRow({
  draft,
  isDefault,
  canRemove,
  onChange,
  onRemove,
  onSetDefault,
}: {
  draft: DraftValue;
  isDefault: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<DraftValue>) => void;
  onRemove: () => void;
  onSetDefault: () => void;
}) {
  const labelGen = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/category-filters/sections/label/translate");

  async function generate() {
    const outcome = await labelGen.generate({ text: draft.label });
    if (!outcome) return;
    const next = { ...draft.translations };
    for (const [lang, value] of Object.entries(outcome.result) as [OverlayLang, string][]) {
      if (value) next[lang] = { ...next[lang], label: value };
    }
    onChange({ translations: next });
    const errorSummary = summarizeGenerateErrors(outcome.errors);
    if (errorSummary) labelGen.setError(errorSummary);
  }

  return (
    <div className={styles.draftValueCard}>
      <div className={styles.draftValueTop}>
        <input
          className={ui.input}
          value={draft.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="Value key, e.g. leather"
        />
        <label className={styles.defaultRadioLabel}>
          <input type="radio" name="defaultDraftValue" checked={isDefault} onChange={onSetDefault} />
          Default
        </label>
        <button type="button" className={styles.draftValueRemove} onClick={onRemove} disabled={!canRemove} aria-label="Remove value">
          <X size={14} strokeWidth={2.25} />
        </button>
      </div>
      <BilingualField
        label="Label"
        field="label"
        baseValue={draft.label}
        baseOnChange={(v) => onChange({ label: v })}
        basePlaceholder="e.g. Leather"
        baseRequired
        translations={draft.translations}
        onTranslationChange={(lang, field, value) => onChange({ translations: { ...draft.translations, [lang]: { ...draft.translations[lang], [field]: value } } })}
        overlayPlaceholder="Cuir"
        onGenerate={generate}
        generating={labelGen.generating}
        generateError={labelGen.error}
      />
    </div>
  );
}

export default function CategoryFiltersPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [category, setCategory] = useState<CategoryLite | null>(null);
  const [filters, setFilters] = useState<CategoryFilter[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterForm, setFilterForm] = useState<FilterFormState | null>(null);
  const [valueForm, setValueForm] = useState<ValueFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const { translations: filterTr, setTranslation: setFilterTr, saveTranslations: saveFilterTr } = useEntityTranslations(
    FILTER_ENTITY_TYPE,
    filterForm?.id ?? null,
  );
  const { translations: valueTr, setTranslation: setValueTr, saveTranslations: saveValueTr } = useEntityTranslations(
    VALUE_ENTITY_TYPE,
    valueForm?.id ?? null,
  );

  const nameGen = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/category-filters/sections/name/translate");
  const labelGen = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/category-filters/sections/label/translate");

  async function generateFilterName() {
    if (!filterForm) return;
    const outcome = await nameGen.generate({ text: filterForm.name });
    if (!outcome) return;
    for (const [lang, value] of Object.entries(outcome.result) as [OverlayLang, string][]) {
      if (value) setFilterTr(lang, "name", value);
    }
    const errorSummary = summarizeGenerateErrors(outcome.errors);
    if (errorSummary) nameGen.setError(errorSummary);
  }

  async function generateValueLabel() {
    if (!valueForm) return;
    const outcome = await labelGen.generate({ text: valueForm.label });
    if (!outcome) return;
    for (const [lang, value] of Object.entries(outcome.result) as [OverlayLang, string][]) {
      if (value) setValueTr(lang, "label", value);
    }
    const errorSummary = summarizeGenerateErrors(outcome.errors);
    if (errorSummary) labelGen.setError(errorSummary);
  }

  async function load() {
    setLoading(true);
    try {
      const [cat, filterList] = await Promise.all([
        api.get<CategoryLite>(`/next-api/admin/shop/categories/${params.id}`),
        api.get<CategoryFilter[]>(`/next-api/admin/shop/categories/${params.id}/filters`),
      ]);
      setCategory(cat);
      setFilters(filterList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function openNewFilter() {
    const first = newDraftValue();
    setFilterForm({ id: null, name: "", slug: "", sortOrder: 0, isActive: true, draftValues: [first], defaultDraftKey: first.key });
  }

  function addDraftValue() {
    if (!filterForm) return;
    const row = newDraftValue();
    setFilterForm({ ...filterForm, draftValues: [...filterForm.draftValues, row] });
  }

  function removeDraftValue(key: string) {
    if (!filterForm) return;
    const remaining = filterForm.draftValues.filter((v) => v.key !== key);
    setFilterForm({
      ...filterForm,
      draftValues: remaining,
      defaultDraftKey: filterForm.defaultDraftKey === key ? (remaining[0]?.key ?? "") : filterForm.defaultDraftKey,
    });
  }

  function updateDraftValue(key: string, patch: Partial<DraftValue>) {
    if (!filterForm) return;
    setFilterForm({ ...filterForm, draftValues: filterForm.draftValues.map((v) => (v.key === key ? { ...v, ...patch } : v)) });
  }

  async function handleFilterSubmit(e: FormEvent) {
    e.preventDefault();
    if (!filterForm) return;
    setSaving(true);
    try {
      let entityId = filterForm.id;
      if (filterForm.id) {
        await api.patch(`/next-api/admin/shop/category-filters/${filterForm.id}`, {
          name: filterForm.name,
          slug: filterForm.slug || undefined,
          sortOrder: filterForm.sortOrder,
          isActive: filterForm.isActive,
        });
      } else {
        const filledDrafts = filterForm.draftValues.filter((v) => v.value.trim() && v.label.trim());
        if (filledDrafts.length === 0) {
          toast.error("Add at least one value");
          setSaving(false);
          return;
        }
        const values = filledDrafts.map((v, i) => ({ value: v.value, label: v.label, sortOrder: i, isDefault: v.key === filterForm.defaultDraftKey }));
        const created = await api.post<CategoryFilter>(`/next-api/admin/shop/categories/${params.id}/filters`, {
          name: filterForm.name,
          slug: filterForm.slug || undefined,
          sortOrder: filterForm.sortOrder,
          isActive: filterForm.isActive,
          values,
        });
        entityId = created.id;
        // Matched by `value` (the machine key), not position — a draft row's
        // real id only exists after this response, and the key is the one
        // thing guaranteed unique per row on both sides of the round trip.
        await Promise.all(
          filledDrafts.map((draft) => {
            const createdValue = created.values.find((cv) => cv.value === draft.value);
            return createdValue ? saveTranslationsFor(VALUE_ENTITY_TYPE, createdValue.id, draft.translations, ["label"]) : Promise.resolve();
          }),
        );
      }
      if (entityId) await saveFilterTr(entityId, ["name"]);
      toast.success(filterForm.id ? "Filter updated" : "Filter created");
      setFilterForm(null);
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to save filter"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteFilter(filter: CategoryFilter) {
    if (!confirm(`Delete filter "${filter.name}"? Products lose their value for it.`)) return;
    try {
      await api.delete(`/next-api/admin/shop/category-filters/${filter.id}`);
      toast.success("Filter deleted");
      setExpanded((id) => (id === filter.id ? null : id));
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to delete filter"));
    }
  }

  async function handleValueSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valueForm) return;
    setSaving(true);
    const payload = { value: valueForm.value, label: valueForm.label, sortOrder: valueForm.sortOrder, isDefault: valueForm.isDefault };
    try {
      let entityId = valueForm.id;
      if (valueForm.id) {
        await api.patch(`/next-api/admin/shop/category-filters/${valueForm.filterId}/values/${valueForm.id}`, payload);
      } else {
        const created = await api.post<FilterValue>(`/next-api/admin/shop/category-filters/${valueForm.filterId}/values`, payload);
        entityId = created.id;
      }
      if (entityId) await saveValueTr(entityId, ["label"]);
      toast.success(valueForm.id ? "Value updated" : "Value added");
      setValueForm(null);
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to save value"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteValue(filterId: string, value: FilterValue) {
    if (!confirm(`Delete value "${value.label}"? Products carrying it lose it.`)) return;
    try {
      await api.delete(`/next-api/admin/shop/category-filters/${filterId}/values/${value.id}`);
      toast.success("Value deleted");
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to delete value"));
    }
  }

  return (
    <div className={ui.page}>
      <div className={`${ui.pageHeader} ${styles.stickyHeader}`}>
        <div className={styles.headerTitle}>
          <Link href="/admin/shop/categories" className={styles.backLink}>
            ← Categories
          </Link>
          <h1 className={ui.pageTitle}>{category ? `Filters — ${category.name}` : "Filters"}</h1>
        </div>
        <Button onClick={openNewFilter}>New filter</Button>
      </div>

      {loading ? (
        <div className={ui.card}>
          <div className={ui.emptyState}>Loading…</div>
        </div>
      ) : filters.length === 0 ? (
        <div className={ui.card}>
          <div className={ui.emptyState}>
            No filters yet. Add one (e.g. Material) and every product already in this category gets its default value automatically.
          </div>
        </div>
      ) : (
        filters.map((filter) => {
          const isOpen = expanded === filter.id;
          const toggle = () => setExpanded((id) => (id === filter.id ? null : filter.id));
          return (
            <div key={filter.id} className={ui.card}>
              <div
                className={`${styles.filterHeader} ${isOpen ? styles.filterHeaderOpen : ""}`}
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
                <div className={styles.filterHeaderMain}>
                  <span className={`${styles.expandBtn} ${isOpen ? styles.expandBtnActive : ""}`} aria-hidden="true">
                    <ChevronDown size={14} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} />
                  </span>
                  <strong className={styles.filterName}>{filter.name}</strong>
                  <span className={styles.filterSlug}>{filter.slug}</span>
                  <span className={styles.valueCount} title={`${filter.values.length} value(s)`}>
                    {filter.values.length}
                  </span>
                  <span className={filter.isActive ? ui.badgeActive : ui.badgeInactive}>{filter.isActive ? "active" : "inactive"}</span>
                </div>
                <div className={ui.rowActions} onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setFilterForm({
                        id: filter.id,
                        name: filter.name,
                        slug: filter.slug,
                        sortOrder: filter.sortOrder,
                        isActive: filter.isActive,
                        draftValues: [],
                        defaultDraftKey: "",
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => handleDeleteFilter(filter)}>
                    Delete
                  </Button>
                </div>
              </div>

              {isOpen && (
                <div className={styles.valuesPanel}>
                  <div className={styles.valuesPanelHeader}>
                    <span className={styles.valuesPanelTitle}>Values — {filter.name}</span>
                    <Button
                      variant="secondary"
                      onClick={() => setValueForm({ filterId: filter.id, id: null, value: "", label: "", sortOrder: filter.values.length, isDefault: filter.values.length === 0 })}
                    >
                      Add value
                    </Button>
                  </div>

                  {filter.values.length === 0 ? (
                    <p className={styles.valEmpty}>No values yet — a filter with no values shows nothing on the storefront.</p>
                  ) : (
                    <table className={ui.table}>
                      <thead>
                        <tr>
                          <th>Value</th>
                          <th>Label</th>
                          <th>Order</th>
                          <th>Default</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filter.values.map((v) => (
                          <tr key={v.id}>
                            <td>{v.value}</td>
                            <td>{v.label}</td>
                            <td>{v.sortOrder}</td>
                            <td>{v.isDefault && <span className={styles.defaultBadge}>Default</span>}</td>
                            <td>
                              <div className={ui.rowActions}>
                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    setValueForm({ filterId: filter.id, id: v.id, value: v.value, label: v.label, sortOrder: v.sortOrder, isDefault: v.isDefault })
                                  }
                                >
                                  Edit
                                </Button>
                                <Button variant="danger" onClick={() => handleDeleteValue(filter.id, v)}>
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

      {filterForm && (
        <Modal
          title={filterForm.id ? "Edit filter" : "New filter"}
          onClose={() => setFilterForm(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setFilterForm(null)}>
                Cancel
              </Button>
              <Button type="submit" form={FILTER_FORM_ID} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <form id={FILTER_FORM_ID} onSubmit={handleFilterSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <BilingualField
              label="Name"
              field="name"
              baseValue={filterForm.name}
              baseOnChange={(v) => setFilterForm({ ...filterForm, name: v })}
              basePlaceholder="e.g. Material"
              baseRequired
              translations={filterTr}
              onTranslationChange={setFilterTr}
              overlayPlaceholder="e.g. Matière"
              onGenerate={generateFilterName}
              generating={nameGen.generating}
              generateError={nameGen.error}
            />
            <div className={ui.field}>
              <label className={ui.label}>Slug (optional)</label>
              <input className={ui.input} value={filterForm.slug} onChange={(e) => setFilterForm({ ...filterForm, slug: e.target.value })} placeholder="auto-generated from name" />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Sort order</label>
              <input
                className={ui.input}
                type="number"
                min={0}
                value={filterForm.sortOrder}
                onChange={(e) => setFilterForm({ ...filterForm, sortOrder: Number(e.target.value) })}
              />
            </div>
            <Switch
              label="Active"
              hint="Shown on the storefront's filter sidebar. Turn off to hide this filter without deleting it or losing which value each product carries."
              checked={filterForm.isActive}
              onChange={(v) => setFilterForm({ ...filterForm, isActive: v })}
            />

            {filterForm.id === null && (
              <div className={ui.field}>
                <label className={ui.label}>
                  Values — pick which one is the default. Every product already in this category will be backfilled with it.
                </label>
                <div className={styles.draftValues}>
                  {filterForm.draftValues.map((v) => (
                    <DraftValueRow
                      key={v.key}
                      draft={v}
                      isDefault={filterForm.defaultDraftKey === v.key}
                      canRemove={filterForm.draftValues.length > 1}
                      onChange={(patch) => updateDraftValue(v.key, patch)}
                      onRemove={() => removeDraftValue(v.key)}
                      onSetDefault={() => setFilterForm({ ...filterForm, defaultDraftKey: v.key })}
                    />
                  ))}
                </div>
                <Button type="button" variant="secondary" onClick={addDraftValue} style={{ marginTop: "0.6rem" }}>
                  + Add another value
                </Button>
              </div>
            )}
          </form>
        </Modal>
      )}

      {valueForm && (
        <Modal
          title={valueForm.id ? "Edit value" : "Add value"}
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
              <label className={ui.label}>Value key</label>
              <input className={ui.input} value={valueForm.value} onChange={(e) => setValueForm({ ...valueForm, value: e.target.value })} required autoFocus placeholder="e.g. leather" />
            </div>
            <BilingualField
              label="Label"
              field="label"
              baseValue={valueForm.label}
              baseOnChange={(v) => setValueForm({ ...valueForm, label: v })}
              basePlaceholder="e.g. Leather"
              baseRequired
              translations={valueTr}
              onTranslationChange={setValueTr}
              overlayPlaceholder="Cuir"
              onGenerate={generateValueLabel}
              generating={labelGen.generating}
              generateError={labelGen.error}
            />
            <div className={ui.field}>
              <label className={ui.label}>Sort order</label>
              <input
                className={ui.input}
                type="number"
                min={0}
                value={valueForm.sortOrder}
                onChange={(e) => setValueForm({ ...valueForm, sortOrder: Number(e.target.value) })}
              />
            </div>
            <Switch
              label="Default value"
              hint="Every product already in this category, and every new product added to it, gets this value unless the admin picks a different one. Turning this on turns it off for this filter's other values."
              checked={valueForm.isDefault}
              onChange={(v) => setValueForm({ ...valueForm, isDefault: v })}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
