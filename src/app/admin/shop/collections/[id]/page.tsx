"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { ArrowDown, ArrowUp, GripVertical, ImageOff, Package, Search, Sparkles, Trash2 } from "lucide-react";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import Switch from "@/components/admin/ui/Switch";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import ProductPicker from "@/components/admin/shop/ProductPicker";
import BilingualField from "@/components/admin/BilingualField";
import { useEntityTranslations } from "@/hooks/useEntityTranslations";
import { useCopyGenerate } from "@/hooks/useCopyGenerate";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./CollectionEdit.module.css";
import { useToast } from "@/components/toast/ToastContext";

const ENTITY_TYPE = "shop_collection";
const FORM_ID = "collection-form";

interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageKey: string | null;
  imageUrl: string | null;
  bannerImageKey: string | null;
  bannerImageUrl: string | null;
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

interface CollectionProductLink {
  id: string;
  productId: string;
  sortOrder: number;
  product: { id: string; title: string; featuredImageUrl?: string | null; status?: string };
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { translations, setTranslation, saveTranslations } = useEntityTranslations(ENTITY_TYPE, collection?.id ?? null);

  const gen = useCopyGenerate(setTranslation);

  /**
   * No `setLoading(true)` here. It is already true on the first render, and
   * every later call is a refresh after adding, removing or reordering a
   * product — flipping it back would replace the whole page with "Loading…"
   * and lose the admin's place for each one. (It also tripped
   * react-hooks/set-state-in-effect, being a synchronous setState in the
   * mount effect below.)
   */
  async function load() {
    try {
      // The whole catalogue is no longer pulled up front: the picker below
      // searches server-side, so a shop with more than 200 products is not
      // silently truncated to the first page of them.
      setCollection(await api.get<Collection>(`/next-api/admin/shop/collections/${params.id}`));
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
        bannerImageKey: collection.bannerImageKey,
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
    if (!collection) return;
    setConfirmDelete(false);
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
  const linkedIdList = sortedLinks.map((l) => l.productId);

  return (
    <div className={ui.page}>
      {/* Sticky so Save stays reachable from anywhere in a long form —
          offset by the admin top bar's own sticky height. */}
      <div className={`${ui.pageHeader} ${styles.stickyHeader}`}>
        <div className={styles.headerTitle}>
          <Link href="/admin/shop/collections" className={styles.backLink}>
            ← Collections
          </Link>
          <h1 className={ui.pageTitle}>{collection.name}</h1>
        </div>
        <div className={styles.headerActions}>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
          {/* Outside the form, bound to it by id — the form is further down the page. */}
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className={ui.card}>
        <form id={FORM_ID} onSubmit={handleSubmit} className={styles.form}>
          <BilingualField
            label="Name"
            field="name"
            baseValue={collection.name}
            baseOnChange={(v) => setCollection({ ...collection, name: v })}
            baseRequired
            translations={translations}
            onTranslationChange={setTranslation}
            {...gen.field("name", collection.name)}
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
            {...gen.field("description", collection.description ?? "")}
          />

          <div className={ui.field}>
            <label className={ui.label}>Images</label>
            <div className={styles.imageSlots}>
              <div className={styles.imageSlot}>
                <span className={styles.imageSlotLabel}>Card image</span>
                <span className={styles.imageSlotHint}>Shown on the collections listing.</span>
                <MediaPicker
                  value={collection.imageKey}
                  previewUrl={collection.imageUrl}
                  onChange={(key, url) => setCollection({ ...collection, imageKey: key, imageUrl: url })}
                  label="Card image"
                  mediaType="image"
                  asAddTile
                />
              </div>

              <div className={styles.imageSlot}>
                <span className={styles.imageSlotLabel}>Banner</span>
                <span className={styles.imageSlotHint}>Wide hero on the collection page. Falls back to the card image.</span>
                <MediaPicker
                  value={collection.bannerImageKey}
                  previewUrl={collection.bannerImageUrl}
                  onChange={(key, url) => setCollection({ ...collection, bannerImageKey: key, bannerImageUrl: url })}
                  label="Banner"
                  mediaType="image"
                  asAddTile
                  className={styles.bannerTile}
                />
              </div>
            </div>
          </div>

          {/* The shared Switch, not bare checkboxes: it owns the row layout,
              so a setting with a sentence of explanation cannot wrap into an L
              and drag the next field out of alignment. */}
          <div className={styles.switchGroup}>
            <Switch
              label="Active"
              hint="Off keeps the collection and its products but hides it from the storefront."
              checked={collection.isActive}
              onChange={(isActive) => setCollection({ ...collection, isActive })}
            />
            <Switch
              label="Featured on homepage"
              hint="Eligible for the featured-collections section."
              checked={collection.isFeatured}
              onChange={(isFeatured) => setCollection({ ...collection, isFeatured })}
            />
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

          {/* A real divider, not a bare heading in the middle of a field
              stack: everything below is about the public page rather than the
              collection itself. */}
          <div className={styles.formDivider}>
            <span className={styles.sectionIcon}>
              <Sparkles size={15} strokeWidth={2} />
            </span>
            <div className={styles.sectionHeading}>
              <h2 className={styles.sectionTitle}>SEO &amp; landing page</h2>
              <span className={styles.sectionDesc}>How the collection reads in search results and at the top of its own page.</span>
            </div>
          </div>

          <BilingualField
            label="SEO title"
            field="seoTitle"
            baseValue={collection.seoTitle ?? ""}
            baseOnChange={(v) => setCollection({ ...collection, seoTitle: v || null })}
            translations={translations}
            onTranslationChange={setTranslation}
            {...gen.field("seoTitle", collection.seoTitle ?? "")}
          />
          <BilingualField
            label="SEO description"
            field="seoDescription"
            baseValue={collection.seoDescription ?? ""}
            baseOnChange={(v) => setCollection({ ...collection, seoDescription: v || null })}
            translations={translations}
            onTranslationChange={setTranslation}
            multiline
            {...gen.field("seoDescription", collection.seoDescription ?? "")}
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
            {...gen.field("heroTitle", collection.heroTitle ?? "")}
          />
          <BilingualField
            label="Hero subtitle"
            field="heroSubtitle"
            baseValue={collection.heroSubtitle ?? ""}
            baseOnChange={(v) => setCollection({ ...collection, heroSubtitle: v || null })}
            translations={translations}
            onTranslationChange={setTranslation}
            {...gen.field("heroSubtitle", collection.heroSubtitle ?? "")}
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
            {...gen.field("bodyHtml", collection.bodyHtml ?? "", "html")}
          />
        </form>
      </div>

      <section className={styles.productsCard}>
        <header className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>
            <Package size={16} strokeWidth={2} />
          </span>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Products</h2>
            <span className={styles.sectionDesc}>
              {sortedLinks.length === 0
                ? "Nothing in this collection yet."
                : `${sortedLinks.length} product${sortedLinks.length === 1 ? "" : "s"}, shown in this order on the storefront.`}
            </span>
          </div>
        </header>

        {/* The picker searches the catalogue server-side and never offers a
            product that is already here, so adding is one search and one
            click — the old control was a native <select> holding the first
            200 products in creation order, with no search at all. */}
        <div className={styles.addRow}>
          <ProductPicker
            value=""
            onChange={addProduct}
            label="Add a product"
            placeholder="Search the catalogue…"
            excludeIds={linkedIdList}
            withThumbnails
            className={styles.addPicker}
          />
        </div>

        {sortedLinks.length === 0 ? (
          <div className={styles.emptyProducts}>
            <Search size={20} strokeWidth={1.75} aria-hidden="true" />
            <p>Search above to add the first product.</p>
          </div>
        ) : (
          <ol className={styles.productList}>
            {sortedLinks.map((link, i) => (
              <li key={link.id} className={styles.productRow}>
                <span className={styles.rowHandle} aria-hidden="true">
                  <GripVertical size={14} strokeWidth={2} />
                </span>
                <span className={styles.rowIndex} aria-hidden="true">
                  {i + 1}
                </span>

                {link.product.featuredImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={link.product.featuredImageUrl} alt="" className={styles.rowThumb} loading="lazy" />
                ) : (
                  <span className={`${styles.rowThumb} ${styles.rowThumbEmpty}`} aria-hidden="true">
                    <ImageOff size={14} strokeWidth={2} />
                  </span>
                )}

                <Link href={`/admin/shop/products/${link.productId}`} className={styles.rowTitle}>
                  {link.product.title}
                </Link>

                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    disabled={i === 0}
                    onClick={() => moveProduct(i, -1)}
                    aria-label={`Move ${link.product.title} up`}
                  >
                    <ArrowUp size={14} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    disabled={i === sortedLinks.length - 1}
                    onClick={() => moveProduct(i, 1)}
                    aria-label={`Move ${link.product.title} down`}
                  >
                    <ArrowDown size={14} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={() => removeProduct(link.productId)}
                    aria-label={`Remove ${link.product.title}`}
                  >
                    <Trash2 size={14} strokeWidth={2.2} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {confirmDelete && collection && (
        <Modal
          title="Delete collection"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </>
          }
        >
          <p>
            Delete <strong>{collection.name}</strong>? The products stay in the catalogue — only the collection and its ordering
            are removed. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
