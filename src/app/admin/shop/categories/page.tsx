"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, ImageOff } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import btnStyles from "@/components/admin/ui/Button.module.css";
import Modal from "@/components/admin/ui/Modal";
import BilingualField from "@/components/admin/BilingualField";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import Switch from "@/components/admin/ui/Switch";
import PriceRangeSlider from "@/components/shop/PriceRangeSlider";
import { useEntityTranslations } from "@/hooks/useEntityTranslations";
import { getAncestorIds, visibleRows } from "@/lib/shop/categoryTree";
import { useCopyGenerate } from "@/hooks/useCopyGenerate";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./Categories.module.css";
import { useToast } from "@/components/toast/ToastContext";

const ENTITY_TYPE = "shop_product_category";
const TRANSLATION_FIELDS = ["name", "description"];

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageKey: string | null;
  /** Resolved by the API — `imageKey` alone is a storage key the browser
   *  cannot render. */
  imageUrl: string | null;
  bannerKey: string | null;
  bannerUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  showPriceFilter: boolean;
  priceFilterMinCents: number | null;
  priceFilterMaxCents: number | null;
}

interface CategoryRow extends Category {
  depth: number;
  /** Drives the disclosure control — a row with none is a leaf. */
  childCount: number;
}

interface FormState {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  /** What gets saved. */
  imageKey: string | null;
  /** What gets shown while editing — never sent. */
  imageUrl: string | null;
  bannerKey: string | null;
  bannerUrl: string | null;
  parentId: string;
  sortOrder: number;
  isActive: boolean;
  showPriceFilter: boolean;
  /** Euros, as typed — converted to cents on submit, same as every other
   *  price field in the admin. */
  priceFilterMinCents: string;
  priceFilterMaxCents: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  slug: "",
  description: "",
  imageKey: null,
  imageUrl: null,
  bannerKey: null,
  bannerUrl: null,
  parentId: "",
  sortOrder: 0,
  isActive: true,
  // Off by default: turning it on requires bounds, and a brand-new category
  // has none to suggest.
  showPriceFilter: false,
  priceFilterMinCents: "",
  priceFilterMaxCents: "",
};
const FORM_ID = "category-form";

function eur(cents: number | null): string {
  return cents === null || cents === undefined ? "" : String(cents / 100);
}
function toCents(v: string): number | null {
  return v.trim() === "" ? null : Math.round(Number(v) * 100);
}
function euroLabel(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

/**
 * The two inputs behind "Price filter" — min/max in euros — plus a live
 * preview of the exact slider a shopper will see on this category's page.
 * Reuses PriceRangeSlider itself rather than mocking up a second one: what
 * you see here is what ships.
 *
 * The preview is debounced (350ms, the same delay this admin already uses
 * for search-as-you-type elsewhere) so it settles a beat after typing stops
 * instead of re-laying-out the slider on every keystroke, and it's
 * non-interactive — dragging a preview that doesn't write back to the two
 * number fields above it would just be a second, disagreeing source of truth.
 */
function PriceFilterFields({
  minCents,
  maxCents,
  onChangeMin,
  onChangeMax,
}: {
  minCents: string;
  maxCents: string;
  onChangeMin: (v: string) => void;
  onChangeMax: (v: string) => void;
}) {
  const [debouncedMin, setDebouncedMin] = useState(minCents);
  const [debouncedMax, setDebouncedMax] = useState(maxCents);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedMin(minCents), 350);
    return () => clearTimeout(t);
  }, [minCents]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMax(maxCents), 350);
    return () => clearTimeout(t);
  }, [maxCents]);

  const previewMin = toCents(debouncedMin);
  const previewMax = toCents(debouncedMax);
  const hasValidPreview = previewMin !== null && previewMax !== null && previewMin < previewMax;

  return (
    <div className={styles.priceFilterFields}>
      <div className={ui.formGrid}>
        <div className={ui.field}>
          <label className={ui.label}>Minimum price (€)</label>
          <input className={ui.input} type="number" step="0.01" min="0" value={minCents} onChange={(e) => onChangeMin(e.target.value)} required />
        </div>
        <div className={ui.field}>
          <label className={ui.label}>Maximum price (€)</label>
          <input className={ui.input} type="number" step="0.01" min="0" value={maxCents} onChange={(e) => onChangeMax(e.target.value)} required />
        </div>
      </div>
      <div className={styles.pricePreview}>
        <span className={styles.pricePreviewLabel}>Storefront preview</span>
        {hasValidPreview ? (
          <div className={styles.pricePreviewSlider} aria-hidden="true">
            <PriceRangeSlider
              boundsMinCents={previewMin}
              boundsMaxCents={previewMax}
              valueMinCents={previewMin}
              valueMaxCents={previewMax}
              onCommit={() => {}}
              minLabel="Minimum"
              maxLabel="Maximum"
              formatValue={euroLabel}
            />
          </div>
        ) : (
          <span className={styles.hint}>Enter a minimum and a maximum to preview the slider.</span>
        )}
      </div>
    </div>
  );
}

/** Depth-first flattening of the category list into parent/child rows for indented table display.
 *  Categories whose parent no longer exists (e.g. the parent was deleted) are appended at depth 0
 *  rather than dropped, so they stay visible and editable. */
function buildTree(categories: Category[]): CategoryRow[] {
  const idSet = new Set(categories.map((c) => c.id));
  const rows: CategoryRow[] = [];

  function traverse(category: Category, depth: number) {
    const children = categories
      .filter((c) => c.parentId === category.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    rows.push({ ...category, depth, childCount: children.length });
    children.forEach((child) => traverse(child, depth + 1));
  }

  categories
    .filter((c) => !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((c) => traverse(c, 0));

  categories
    .filter((c) => c.parentId && !idSet.has(c.parentId))
    .forEach((c) => rows.push({ ...c, depth: 0, childCount: 0 }));

  return rows;
}

export default function CategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  /* Which parents are open. Collapsed by default: the table's job is to show
     the shape of the tree, and a deep catalogue expanded on arrival is a wall
     of rows with the top level lost inside it. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { translations, setTranslation, saveTranslations } = useEntityTranslations(ENTITY_TYPE, form?.id ?? null);
  const gen = useCopyGenerate(setTranslation);

  async function load(): Promise<Category[]> {
    setLoading(true);
    try {
      const data = await api.get<Category[]>("/next-api/admin/shop/categories");
      setCategories(data);
      return data;
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;

    const priceFilterMinCents = toCents(form.priceFilterMinCents);
    const priceFilterMaxCents = toCents(form.priceFilterMaxCents);
    if (form.showPriceFilter) {
      if (priceFilterMinCents === null || priceFilterMaxCents === null) {
        toast.error("Set a minimum and maximum price before turning the price filter on");
        return;
      }
      if (priceFilterMinCents >= priceFilterMaxCents) {
        toast.error("The price filter's minimum must be less than its maximum");
        return;
      }
    }

    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      description: form.description || null,
      // Explicitly null rather than omitted: clearing the image has to reach the
      // API as "unset this", and an absent key would leave the old one in place.
      imageKey: form.imageKey,
      bannerKey: form.bannerKey,
      parentId: form.parentId || null,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
      showPriceFilter: form.showPriceFilter,
      priceFilterMinCents,
      priceFilterMaxCents,
    };
    try {
      let savedId = form.id;
      if (form.id) {
        await api.patch(`/next-api/admin/shop/categories/${form.id}`, payload);
      } else {
        const created = await api.post<Category>("/next-api/admin/shop/categories", payload);
        savedId = created.id;
      }
      if (savedId) await saveTranslations(savedId, TRANSLATION_FIELDS);
      toast.success(form.id ? "Category updated" : "Category created");
      setForm(null);
      const fresh = await load();
      // A child saved under a collapsed parent would otherwise vanish the
      // moment it was created, which reads as the save having failed.
      if (savedId) {
        const path = getAncestorIds(fresh, savedId);
        if (path.length) setExpanded((prev) => new Set([...prev, ...path]));
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to save category") : "Failed to save category");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: Category) {
    if (!confirm(`Delete category "${category.name}"?`)) return;
    try {
      await api.delete(`/next-api/admin/shop/categories/${category.id}`);
      toast.success("Category deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to delete category") : "Failed to delete category");
    }
  }

  const treeRows = buildTree(categories);
  const rows = visibleRows(treeRows, expanded);
  const parentIds = treeRows.filter((r) => r.childCount > 0).map((r) => r.id);
  const allExpanded = parentIds.length > 0 && parentIds.every((id) => expanded.has(id));

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Categories</h1>
        <div className={styles.headerActions}>
          {parentIds.length > 0 && (
            <Button variant="secondary" onClick={() => setExpanded(allExpanded ? new Set() : new Set(parentIds))}>
              {allExpanded ? "Collapse all" : "Expand all"}
            </Button>
          )}
          <Button onClick={() => setForm({ ...EMPTY_FORM })}>New category</Button>
        </div>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : categories.length === 0 ? (
          <div className={ui.emptyState}>No categories yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th className={styles.thumbHead}>Image</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Sort order</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className={styles.row}
                  style={{ "--depth-indent": `${c.depth * 22}px` } as React.CSSProperties}
                >
                  <td>
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" className={styles.thumb} />
                    ) : (
                      <span className={`${styles.thumb} ${styles.thumbEmpty}`} title="No image — the home page tile falls back to a plain panel">
                        <ImageOff size={14} strokeWidth={2} />
                      </span>
                    )}
                  </td>
                  <td>
                    <div className={styles.depthIndent}>
                      {c.childCount > 0 ? (
                        <button
                          type="button"
                          className={styles.disclosure}
                          onClick={() => toggle(c.id)}
                          aria-expanded={expanded.has(c.id)}
                          aria-label={`${expanded.has(c.id) ? "Collapse" : "Expand"} ${c.name}`}
                        >
                          <ChevronRight
                            size={14}
                            strokeWidth={2.4}
                            className={`${styles.chevron} ${expanded.has(c.id) ? styles.chevronOpen : ""}`}
                          />
                        </button>
                      ) : (
                        /* Keeps every name on the same left edge whether or not
                           its row has a control in front of it. */
                        <span className={styles.disclosureSpacer} aria-hidden="true">
                          {c.depth > 0 && <span className={styles.depthLine} />}
                        </span>
                      )}

                      {c.childCount > 0 ? (
                        <button type="button" className={styles.catNameToggle} onClick={() => toggle(c.id)}>
                          <span className={styles.catName}>{c.name}</span>
                          <span className={styles.childCount}>{c.childCount}</span>
                        </button>
                      ) : (
                        <span className={styles.catName}>{c.name}</span>
                      )}
                    </div>
                  </td>
                  <td className={styles.catSlug}>{c.slug}</td>
                  <td className={styles.sortOrderCell}>{c.sortOrder}</td>
                  <td>
                    <span className={c.isActive ? ui.badgeActive : ui.badgeInactive}>{c.isActive ? "active" : "inactive"}</span>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      {/* Filters are a leaf-category concept — a branch
                          category shows its children on the storefront, never
                          products, so there is nothing for a filter to narrow. */}
                      {c.childCount === 0 && (
                        <Link href={`/admin/shop/categories/${c.id}/filters`} className={`${btnStyles.button} ${btnStyles.secondary}`}>
                          Filters
                        </Link>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setForm({
                            id: c.id,
                            name: c.name,
                            slug: c.slug,
                            description: c.description ?? "",
                            imageKey: c.imageKey,
                            imageUrl: c.imageUrl,
                            bannerKey: c.bannerKey,
                            bannerUrl: c.bannerUrl,
                            parentId: c.parentId ?? "",
                            sortOrder: c.sortOrder,
                            isActive: c.isActive,
                            showPriceFilter: c.showPriceFilter,
                            priceFilterMinCents: eur(c.priceFilterMinCents),
                            priceFilterMaxCents: eur(c.priceFilterMaxCents),
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => handleDelete(c)}>
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
          title={form.id ? "Edit category" : "New category"}
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
            <BilingualField
              label="Name"
              field="name"
              baseValue={form.name}
              baseOnChange={(v) => setForm({ ...form, name: v })}
              baseRequired
              translations={translations}
              onTranslationChange={setTranslation}
              {...gen.field("name", form.name)}
            />
            <div className={ui.field}>
              <label className={ui.label}>Slug (optional)</label>
              <input className={ui.input} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated from name" />
            </div>
            <BilingualField
              label="Description"
              field="description"
              baseValue={form.description}
              baseOnChange={(v) => setForm({ ...form, description: v })}
              translations={translations}
              onTranslationChange={setTranslation}
              multiline
              rows={3}
              {...gen.field("description", form.description)}
            />
            <div className={ui.field}>
              <label className={ui.label}>Tile image</label>
              <div className={styles.imageField}>
                <MediaPicker
                  value={form.imageKey}
                  previewUrl={form.imageUrl}
                  mediaType="image"
                  label="category image"
                  asAddTile
                  className={styles.imageTile}
                  onChange={(imageKey, imageUrl) => setForm({ ...form, imageKey, imageUrl })}
                />
                <span className={styles.hint}>
                  Shown as the tile for this category in the home page&rsquo;s &ldquo;Shop by category&rdquo; section.
                  Tiles are tall and cropped to fill, so a portrait image works best. Without one the tile falls back to
                  a plain coloured panel.
                </span>
              </div>
            </div>

            <div className={ui.field}>
              <label className={ui.label}>Banner</label>
              <div className={styles.imageField}>
                <MediaPicker
                  value={form.bannerKey}
                  previewUrl={form.bannerUrl}
                  mediaType="image"
                  label="category banner"
                  asAddTile
                  className={styles.bannerTile}
                  onChange={(bannerKey, bannerUrl) => setForm({ ...form, bannerKey, bannerUrl })}
                />
                <span className={styles.hint}>
                  Printed across the top of this category&rsquo;s listing page. A wide crop — roughly 3:1 — since it is
                  cut to a shallow band. Leave empty and the page simply starts with the heading.
                </span>
              </div>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Parent category</label>
              <select className={ui.select} value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                <option value="">None</option>
                {categories
                  .filter((c) => c.id !== form.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Sort order</label>
              <input
                className={ui.input}
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
              <span className={styles.hint}>Lower numbers appear first</span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
            <Switch
              label="Price filter"
              hint="Shows the price-range slider on this category's storefront page. Only matters for a leaf category — a category with subcategories shows those instead of a filtered product grid."
              checked={form.showPriceFilter}
              onChange={(v) => setForm({ ...form, showPriceFilter: v })}
            />
            {form.showPriceFilter && (
              <PriceFilterFields
                minCents={form.priceFilterMinCents}
                maxCents={form.priceFilterMaxCents}
                onChangeMin={(v) => setForm({ ...form, priceFilterMinCents: v })}
                onChangeMax={(v) => setForm({ ...form, priceFilterMaxCents: v })}
              />
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
