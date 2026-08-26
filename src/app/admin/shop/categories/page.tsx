"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ImageOff } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import BilingualField from "@/components/admin/BilingualField";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import { useEntityTranslations } from "@/hooks/useEntityTranslations";
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
}

interface CategoryRow extends Category {
  depth: number;
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
};
const FORM_ID = "category-form";

/** Depth-first flattening of the category list into parent/child rows for indented table display.
 *  Categories whose parent no longer exists (e.g. the parent was deleted) are appended at depth 0
 *  rather than dropped, so they stay visible and editable. */
function buildTree(categories: Category[]): CategoryRow[] {
  const idSet = new Set(categories.map((c) => c.id));
  const rows: CategoryRow[] = [];

  function traverse(category: Category, depth: number) {
    rows.push({ ...category, depth });
    categories
      .filter((c) => c.parentId === category.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((child) => traverse(child, depth + 1));
  }

  categories
    .filter((c) => !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((c) => traverse(c, 0));

  categories.filter((c) => c.parentId && !idSet.has(c.parentId)).forEach((c) => rows.push({ ...c, depth: 0 }));

  return rows;
}

export default function CategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const { translations, setTranslation, saveTranslations } = useEntityTranslations(ENTITY_TYPE, form?.id ?? null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Category[]>("/next-api/admin/shop/categories");
      setCategories(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
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
      await load();
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

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Categories</h1>
        <Button onClick={() => setForm({ ...EMPTY_FORM })}>New category</Button>
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
              {treeRows.map((c) => (
                <tr key={c.id}>
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
                    <div className={styles.depthIndent} style={{ paddingLeft: c.depth * 20 }}>
                      {c.depth > 0 && <span className={styles.depthLine} />}
                      <span className={styles.catName}>{c.name}</span>
                    </div>
                  </td>
                  <td className={styles.catSlug}>{c.slug}</td>
                  <td className={styles.sortOrderCell}>{c.sortOrder}</td>
                  <td>
                    <span className={c.isActive ? ui.badgeActive : ui.badgeInactive}>{c.isActive ? "active" : "inactive"}</span>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
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
          </form>
        </Modal>
      )}
    </div>
  );
}
