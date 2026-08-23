"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface FormState {
  id: string | null;
  name: string;
  slug: string;
}

const FORM_ID = "tag-form";

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setTags(await api.get<Tag[]>("/next-api/admin/shop/tags"));
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
    setError(null);
    try {
      const payload = { name: form.name, slug: form.slug || undefined };
      if (form.id) await api.patch(`/next-api/admin/shop/tags/${form.id}`, payload);
      else await api.post("/next-api/admin/shop/tags", payload);
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tag: Tag) {
    if (!confirm(`Delete tag "${tag.name}"?`)) return;
    await api.delete(`/next-api/admin/shop/tags/${tag.id}`);
    await load();
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Tags</h1>
        <Button onClick={() => setForm({ id: null, name: "", slug: "" })}>New tag</Button>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : tags.length === 0 ? (
          <div className={ui.emptyState}>No tags yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tags.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.slug}</td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button variant="secondary" onClick={() => setForm({ id: t.id, name: t.name, slug: t.slug })}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => handleDelete(t)}>
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
          title={form.id ? "Edit tag" : "New tag"}
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
              <label className={ui.label}>Name</label>
              <input className={ui.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Slug (optional)</label>
              <input className={ui.input} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated from name" />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
