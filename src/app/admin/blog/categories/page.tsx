"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import BilingualField from "@/components/admin/BilingualField";
import { useEntityTranslations } from "@/hooks/useEntityTranslations";
import { useCopyGenerate } from "@/hooks/useCopyGenerate";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { useToast } from "@/components/toast/ToastContext";

const ENTITY_TYPE = "blog_category";
const TRANSLATION_FIELDS = ["name", "description"];

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface FormState {
  id: string | null;
  name: string;
  slug: string;
  color: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { id: null, name: "", slug: "", color: "#129c98", description: "", sortOrder: 0, isActive: true };
const FORM_ID = "blog-category-form";

export default function BlogCategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const { translations, setTranslation, saveTranslations } = useEntityTranslations(ENTITY_TYPE, form?.id ?? null);

  const gen = useCopyGenerate(setTranslation);

  async function load() {
    setLoading(true);
    try {
      setCategories(await api.get<Category[]>("/next-api/admin/blog/categories"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      color: form.color || null,
      description: form.description || null,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
    };
    try {
      let savedId = form.id;
      if (form.id) {
        await api.patch(`/next-api/admin/blog/categories/${form.id}`, payload);
      } else {
        const created = await api.post<Category>("/next-api/admin/blog/categories", payload);
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
      await api.delete(`/next-api/admin/blog/categories/${category.id}`);
      toast.success("Category deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to delete category") : "Failed to delete category");
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Blog categories</h1>
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
                <th>Name</th>
                <th>Slug</th>
                <th>Color</th>
                <th>Sort order</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.slug}</td>
                  <td>
                    {c.color && (
                      <span
                        style={{
                          display: "inline-block",
                          width: 14,
                          height: 14,
                          borderRadius: 4,
                          background: c.color,
                          border: "1px solid var(--color-surface)",
                        }}
                        title={c.color}
                      />
                    )}
                  </td>
                  <td>{c.sortOrder}</td>
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
                            color: c.color ?? "#129c98",
                            description: c.description ?? "",
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
              <label className={ui.label}>Color</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                style={{ width: 60, height: 36, padding: 0, border: "1.5px solid var(--color-surface)", borderRadius: 8, background: "var(--background)" }}
              />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Sort order</label>
              <input
                className={ui.input}
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
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
