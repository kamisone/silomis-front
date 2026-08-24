"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import BilingualField from "@/components/admin/BilingualField";
import { useEntityTranslations } from "@/hooks/useEntityTranslations";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { useToast } from "@/components/toast/ToastContext";

const ENTITY_TYPE = "shop_collection";

interface CollectionProductLink {
  id: string;
  productId: string;
  sortOrder: number;
  product: { id: string; title: string };
}

interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageKey: string | null;
  imageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  metaKeywords: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroCopy: string | null;
  bodyHtml: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: string | null;
  productLinks: CollectionProductLink[];
}

interface ProductLite {
  id: string;
  title: string;
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { translations, setTranslation, saveTranslations } = useEntityTranslations(ENTITY_TYPE, collection?.id ?? null);

  async function load() {
    setLoading(true);
    try {
      const [c, prodRes] = await Promise.all([
        api.get<Collection>(`/next-api/admin/shop/collections/${params.id}`),
        api.get<{ items: ProductLite[]; total: number }>("/next-api/admin/shop/products?limit=200"),
      ]);
      setCollection(c);
      setProducts(prodRes.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!collection) return;
    setSaving(true);
    try {
      const updated = await api.patch<Collection>(`/next-api/admin/shop/collections/${collection.id}`, {
        name: collection.name,
        slug: collection.slug,
        description: collection.description,
        imageKey: collection.imageKey,
        seoTitle: collection.seoTitle,
        seoDescription: collection.seoDescription,
        metaKeywords: collection.metaKeywords,
        heroTitle: collection.heroTitle,
        heroSubtitle: collection.heroSubtitle,
        heroCopy: collection.heroCopy,
        bodyHtml: collection.bodyHtml,
        isActive: collection.isActive,
        isFeatured: collection.isFeatured,
        sortOrder: collection.sortOrder,
        publishedAt: collection.publishedAt ? new Date(collection.publishedAt).toISOString() : null,
      });
      await saveTranslations(collection.id, ["name", "description", "seoTitle", "seoDescription", "heroTitle", "heroSubtitle", "bodyHtml"]);

      setCollection({ ...updated, productLinks: collection.productLinks });
      toast.success("Changes saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addProduct(productId: string) {
    if (!collection || !productId) return;
    try {
      await api.post(`/next-api/admin/shop/collections/${collection.id}/products`, { productId });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to add product") : "Failed to add product");
    }
  }

  async function removeProduct(productId: string) {
    if (!collection) return;
    try {
      await api.delete(`/next-api/admin/shop/collections/${collection.id}/products/${productId}`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to remove product") : "Failed to remove product");
    }
  }

  async function moveProduct(index: number, direction: -1 | 1) {
    if (!collection) return;
    const links = [...collection.productLinks].sort((a, b) => a.sortOrder - b.sortOrder);
    const target = index + direction;
    if (target < 0 || target >= links.length) return;
    [links[index], links[target]] = [links[target], links[index]];
    try {
      await api.put(`/next-api/admin/shop/collections/${collection.id}/products/reorder`, { productIds: links.map((l) => l.productId) });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to reorder") : "Failed to reorder");
    }
  }

  async function handleDelete() {
    if (!collection || !confirm(`Delete collection "${collection.name}"?`)) return;
    try {
      await api.delete(`/next-api/admin/shop/collections/${collection.id}`);
      toast.success("Collection deleted");
      router.push("/admin/shop/collections");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to delete collection") : "Failed to delete collection");
    }
  }

  if (loading || !collection) {
    return (
      <div className={ui.page}>
        <div className={ui.emptyState}>Loading…</div>
      </div>
    );
  }

  const sortedLinks = [...collection.productLinks].sort((a, b) => a.sortOrder - b.sortOrder);
  const linkedIds = new Set(sortedLinks.map((l) => l.productId));

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <Link href="/admin/shop/collections" style={{ fontSize: "0.85rem", color: "var(--color-secondary)" }}>
            ← Collections
          </Link>
          <h1 className={ui.pageTitle}>{collection.name}</h1>
        </div>
        <Button variant="danger" onClick={handleDelete}>
          Delete
        </Button>
      </div>

      <div className={ui.card}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 640 }}>
          <BilingualField
            label="Name"
            field="name"
            baseValue={collection.name}
            baseOnChange={(v) => setCollection({ ...collection, name: v })}
            baseRequired
            translations={translations}
            onTranslationChange={setTranslation}
          />

          <div className={ui.field}>
            <label className={ui.label}>Slug</label>
            <input className={ui.input} value={collection.slug} onChange={(e) => setCollection({ ...collection, slug: e.target.value })} required />
          </div>

          <BilingualField
            label="Description"
            field="description"
            baseValue={collection.description ?? ""}
            baseOnChange={(v) => setCollection({ ...collection, description: v || null })}
            translations={translations}
            onTranslationChange={setTranslation}
            multiline
          />

          <div className={ui.field}>
            <label className={ui.label}>Image</label>
            <MediaPicker
              value={collection.imageKey}
              previewUrl={collection.imageUrl}
              onChange={(key, url) => setCollection({ ...collection, imageKey: key, imageUrl: url })}
              label="collection image"
            />
          </div>

          <div className={ui.formGrid}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={collection.isActive} onChange={(e) => setCollection({ ...collection, isActive: e.target.checked })} />
              Active
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={collection.isFeatured} onChange={(e) => setCollection({ ...collection, isFeatured: e.target.checked })} />
              Featured on homepage
            </label>
          </div>

          <div className={ui.formGrid}>
            <div className={ui.field}>
              <label className={ui.label}>Sort order</label>
              <input className={ui.input} type="number" value={collection.sortOrder} onChange={(e) => setCollection({ ...collection, sortOrder: parseInt(e.target.value || "0", 10) })} />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Published at</label>
              <input
                className={ui.input}
                type="date"
                value={toDateInput(collection.publishedAt)}
                onChange={(e) => setCollection({ ...collection, publishedAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
          </div>

          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginTop: "0.5rem" }}>SEO / landing page</h2>

          <BilingualField
            label="SEO title"
            field="seoTitle"
            baseValue={collection.seoTitle ?? ""}
            baseOnChange={(v) => setCollection({ ...collection, seoTitle: v || null })}
            translations={translations}
            onTranslationChange={setTranslation}
          />
          <BilingualField
            label="SEO description"
            field="seoDescription"
            baseValue={collection.seoDescription ?? ""}
            baseOnChange={(v) => setCollection({ ...collection, seoDescription: v || null })}
            translations={translations}
            onTranslationChange={setTranslation}
            multiline
          />
          <div className={ui.field}>
            <label className={ui.label}>Meta keywords</label>
            <input className={ui.input} value={collection.metaKeywords ?? ""} onChange={(e) => setCollection({ ...collection, metaKeywords: e.target.value || null })} placeholder="comma, separated" />
          </div>
          <BilingualField
            label="Hero title"
            field="heroTitle"
            baseValue={collection.heroTitle ?? ""}
            baseOnChange={(v) => setCollection({ ...collection, heroTitle: v || null })}
            translations={translations}
            onTranslationChange={setTranslation}
          />
          <BilingualField
            label="Hero subtitle"
            field="heroSubtitle"
            baseValue={collection.heroSubtitle ?? ""}
            baseOnChange={(v) => setCollection({ ...collection, heroSubtitle: v || null })}
            translations={translations}
            onTranslationChange={setTranslation}
          />
          <BilingualField
            label="Body HTML (landing page copy)"
            field="bodyHtml"
            baseValue={collection.bodyHtml ?? ""}
            baseOnChange={(v) => setCollection({ ...collection, bodyHtml: v || null })}
            translations={translations}
            onTranslationChange={setTranslation}
            multiline
            rows={6}
          />

          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>

      <div className={ui.card}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Products ({sortedLinks.length})</h2>

        {sortedLinks.length === 0 ? (
          <p className={ui.emptyState}>No products in this collection yet.</p>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {sortedLinks.map((link, i) => (
                <tr key={link.id}>
                  <td>{link.product.title}</td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button variant="secondary" type="button" disabled={i === 0} onClick={() => moveProduct(i, -1)}>
                        ↑
                      </Button>
                      <Button variant="secondary" type="button" disabled={i === sortedLinks.length - 1} onClick={() => moveProduct(i, 1)}>
                        ↓
                      </Button>
                    </div>
                  </td>
                  <td>
                    <Button variant="danger" type="button" onClick={() => removeProduct(link.productId)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={ui.field} style={{ marginTop: "1rem" }}>
          <label className={ui.label}>Add product</label>
          <select
            className={ui.select}
            value=""
            onChange={(e) => {
              if (e.target.value) addProduct(e.target.value);
            }}
          >
            <option value="">Add product…</option>
            {products
              .filter((p) => !linkedIds.has(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </select>
        </div>
      </div>
    </div>
  );
}
