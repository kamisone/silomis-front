"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import BilingualField from "@/components/admin/BilingualField";
import { useEntityTranslations } from "@/hooks/useEntityTranslations";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { useToast } from "@/components/toast/ToastContext";

const ENTITY_TYPE = "shop_collection";

interface Collection {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CollectionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  const { translations, setTranslation, saveTranslations } = useEntityTranslations(ENTITY_TYPE, null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Collection[]; total: number }>("/next-api/admin/shop/collections?limit=200");
      setCollections(res.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setCreating(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await api.post<Collection>("/next-api/admin/shop/collections", { name, slug: slug || slugify(name) });
      await saveTranslations(created.id, ["name"]);
      toast.success("Collection created");
      router.push(`/admin/shop/collections/${created.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to save collection") : "Failed to save collection");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Collection) {
    if (!confirm(`Delete collection "${c.name}"?`)) return;
    try {
      await api.delete(`/next-api/admin/shop/collections/${c.id}`);
      toast.success("Collection deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to delete collection") : "Failed to delete collection");
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Collections</h1>
        <Button onClick={openCreate}>New collection</Button>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)", marginTop: "-0.5rem" }}>
        Curated product groupings — mark one Featured to place it on the homepage, or use its SEO fields as a landing page.
      </p>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : collections.length === 0 ? (
          <div className={ui.emptyState}>No collections yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Featured</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/shop/collections/${c.id}`}>{c.name}</Link>
                  </td>
                  <td>{c.slug}</td>
                  <td>{c.isFeatured ? "Yes" : "—"}</td>
                  <td>
                    <span className={c.isActive ? ui.badgeActive : ui.badgeInactive}>{c.isActive ? "active" : "inactive"}</span>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Link href={`/admin/shop/collections/${c.id}`}>
                        <Button variant="secondary">Edit</Button>
                      </Link>
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

      {creating && (
        <Modal
          title="New collection"
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" form="new-collection-form" disabled={saving}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </>
          }
        >
          <form id="new-collection-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <BilingualField
              label="Name"
              field="name"
              baseValue={name}
              baseOnChange={(v) => {
                setName(v);
                if (!slugEdited) setSlug(slugify(v));
              }}
              baseRequired
              translations={translations}
              onTranslationChange={setTranslation}
            />
            <div className={ui.field}>
              <label className={ui.label}>Slug</label>
              <input
                className={ui.input}
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugEdited(true);
                }}
                required
              />
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>You&apos;ll set the description, SEO copy, and products next.</p>
          </form>
        </Modal>
      )}
    </div>
  );
}
