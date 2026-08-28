"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import BilingualField from "@/components/admin/BilingualField";
import CollapsibleSection from "@/components/admin/shop/CollapsibleSection";
import ProductMediaManager from "@/components/admin/shop/ProductMediaManager";
import ProductInfoSectionsManager from "@/components/admin/shop/ProductInfoSectionsManager";
import ProductTrustBadgesManager from "@/components/admin/shop/ProductTrustBadgesManager";
import ProductFaqsManager from "@/components/admin/shop/ProductFaqsManager";
import ProductZoomedImagesManager, { type ResolvedProductZoomedImage } from "@/components/admin/shop/ProductZoomedImagesManager";
import ProductPackageContentsManager, { type ResolvedProductPackageContentItem } from "@/components/admin/shop/ProductPackageContentsManager";
import ProductDocumentsManager from "@/components/admin/shop/ProductDocumentsManager";
import ProductPrivateLinksManager from "@/components/admin/shop/ProductPrivateLinksManager";
import ProductStoryGalleryManager from "@/components/admin/shop/ProductStoryGalleryManager";
import ProductSocialVideosManager from "@/components/admin/shop/ProductSocialVideosManager";
import ProductUpsellTiersManager from "@/components/admin/shop/ProductUpsellTiersManager";
import { useEntityTranslations, type OverlayLang } from "@/hooks/useEntityTranslations";
import { useSectionGenerate } from "@/hooks/useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import type {
  ResolvedProductMediaItem,
  ProductInfoSection,
  ProductTrustBadge,
  ProductFaq,
  ProductDocument,
  ProductPrivateLink,
  ProductStoryItem,
  ProductSocialVideo,
  ProductUpsellTier,
} from "@/lib/shop/productContent.types";
import { Pencil, DollarSign, Image as ImageIcon, ClipboardList, Shield, HelpCircle, FileText, GalleryHorizontalEnd, Clapperboard, Layers, ZoomIn, Lock, Package, Palette, ImagePlus } from "lucide-react";
import ProductImagePicker from "@/components/admin/shop/ProductImagePicker";
import styles from "../ProductEdit.module.css";

// ── Types ────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
}
interface Tag {
  id: string;
  name: string;
}
interface OptionValue {
  id: string;
  value: string;
  displayValue: string | null;
  sortOrder?: number;
  isActive?: boolean;
  swatchValue?: string | null;
  swatchType?: "color" | "image" | null;
}
interface VariantAttribute {
  id: string;
  name: string;
  slug?: string;
  displayType?: string;
  /** Internal-only label to tell apart attributes that share the same storefront name. */
  adminLabel?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  optionValues: OptionValue[];
}
/** Attributes can share a `name` (two different "Color" sets), so anywhere the admin has to tell them apart the internal label has to come along with it. */
function attrLabel(a: Pick<VariantAttribute, "name" | "adminLabel">): string {
  return a.adminLabel ? `${a.name} — ${a.adminLabel}` : a.name;
}
interface ProductAttr {
  id: string;
  attributeId: string;
  sortOrder: number;
  defaultOptionValueId: string | null;
  attribute: VariantAttribute;
}
interface OptionImage {
  optionValueId: string;
  mediaKey: string;
  url: string | null;
}
interface VariantOptionRow {
  attributeId: string;
  attribute: { id: string; name: string };
  optionValue: OptionValue | null;
  value: string;
}
interface Variant {
  id: string;
  sku: string;
  title: string;
  priceCents: number | null;
  compareAtPriceCents: number | null;
  isDefault: boolean;
  options: VariantOptionRow[];
  inventoryItem: { available: number } | null;
}
interface FreeShipMethod {
  id: string;
  name: string;
  priceCents: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  zone: { name: string; countryCodes?: string[] } | null;
}
/** A method the admin must enable per product — same shape, plus its own country scope. */
interface OptInMethod extends FreeShipMethod {
  isActive: boolean;
  supportedCountryCodes: string[];
}
interface Inventory {
  available: number;
  reserved: number;
  committed: number;
  incoming: number;
  lowStockThreshold: number;
}

interface Product {
  id: string;
  title: string;
  slug: string;
  sku: string | null;
  shortDescription: string | null;
  description: string | null;
  brand: string | null;
  basePriceCents: number | null;
  status: string;
  featured: boolean;
  isTestProduct: boolean;
  freeShipping: boolean;
  freeShippingDaysMin: number | null;
  freeShippingDaysMax: number | null;
  freeShippingUpgradeMethods: Array<{ id: string }> | null;
  shippingMethods: Array<{ id: string }> | null;
  featuredImageKey: string | null;
  featuredImageUrl: string | null;
  media: ResolvedProductMediaItem[];
  infoSections: ProductInfoSection[];
  trustBadges: ProductTrustBadge[];
  faqs: ProductFaq[];
  zoomedImages: ResolvedProductZoomedImage[];
  packageContents: ResolvedProductPackageContentItem[];
  documents: ProductDocument[];
  privateLinks: ProductPrivateLink[];
  storyGallery: ProductStoryItem[];
  socialVideos: ProductSocialVideo[];
  socialVideosTitle: string | null;
  storyNarrativeTitle: string | null;
  upsellingEnabled: boolean;
  upsellTiers: ProductUpsellTier[];
  primaryCategoryId: string | null;
  categories: Category[];
  tags: Tag[];
  variants: Variant[];
}

function eur(cents: number | null): string {
  return cents === null || cents === undefined ? "" : String(cents / 100);
}
function toCents(v: string): number | null {
  return v.trim() === "" ? null : Math.round(Number(v) * 100);
}
function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

const ENTITY_TYPE = "shop_product";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [attributes, setAttributes] = useState<VariantAttribute[]>([]);
  const [freeShipMethods, setFreeShipMethods] = useState<FreeShipMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const { translations, setTranslation, saveTranslations } = useEntityTranslations(ENTITY_TYPE, product?.id ?? null);

  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [stockDelta, setStockDelta] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // ── Product-level variation attributes ───────────────────────────────────
  const [productAttrs, setProductAttrs] = useState<ProductAttr[]>([]);
  const [attrLinkId, setAttrLinkId] = useState("");
  const [attrLinkDefaultId, setAttrLinkDefaultId] = useState("");
  const [attrLinking, setAttrLinking] = useState(false);

  // ── Per-product images for "image" swatch option values ─────────────────
  const [optionImages, setOptionImages] = useState<OptionImage[]>([]);
  const [optInMethods, setOptInMethods] = useState<OptInMethod[]>([]);
  const [optionImagePickerTarget, setOptionImagePickerTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, cats, tgs, attrs, fsm, optIn, prodAttrs, optImages] = await Promise.all([
      api.get<Product>(`/next-api/admin/shop/products/${id}`),
      api.get<Category[]>("/next-api/admin/shop/categories"),
      api.get<Tag[]>("/next-api/admin/shop/tags"),
      api.get<VariantAttribute[]>("/next-api/admin/shop/variant-attributes"),
      api.get<FreeShipMethod[]>("/next-api/admin/shop/shipping/free-shipping-methods").catch(() => []),
      api.get<OptInMethod[]>("/next-api/admin/shop/shipping/product-opt-in-methods").catch(() => []),
      api.get<ProductAttr[]>(`/next-api/admin/shop/products/${id}/attributes`).catch(() => []),
      api.get<OptionImage[]>(`/next-api/admin/shop/products/${id}/option-images`).catch(() => []),
    ]);
    setProduct(p);
    setCategories(cats);
    setTags(tgs);
    setAttributes(attrs);
    setFreeShipMethods(fsm);
    setOptInMethods(optIn);
    setProductAttrs(prodAttrs);
    setOptionImages(optImages);
    const defaultVariant = p.variants.find((v) => v.isDefault) ?? p.variants[0];
    if (defaultVariant) {
      api
        .get<Inventory>(`/next-api/admin/shop/inventory/${defaultVariant.id}`)
        .then(setInventory)
        .catch(() => {});
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // ── Section AI-generate wiring ──────────────────────────────────────────
  const titleGen = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/products/sections/title/translate");
  const shortDescGen = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/products/sections/short-description/translate");
  const descGen = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/products/sections/description/translate");
  const storyTitleGen = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/products/sections/story-narrative-title/translate");
  const socialTitleGen = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/products/sections/social-videos-title/translate");
  const [genErrors, setGenErrors] = useState<Record<string, string | null>>({});

  async function applyPlainGenerate(gen: ReturnType<typeof useSectionGenerate<SectionTranslationOutcome<string>>>, sourceText: string, field: string) {
    const outcome = await gen.generate({ text: sourceText });
    if (!outcome) return;
    for (const [lang, value] of Object.entries(outcome.result) as [OverlayLang, string][]) {
      setTranslation(lang, field, value);
    }
    setGenErrors((prev) => ({ ...prev, [field]: summarizeGenerateErrors(outcome.errors) }));
  }

  if (loading || !product) {
    return (
      <div className={styles.page}>
        <div className={styles.body}>
          <div>
            <div className={styles.skeleton} style={{ height: 200, marginBottom: 16 }} />
            <div className={styles.skeleton} style={{ height: 300 }} />
          </div>
          <div className={styles.skeleton} style={{ height: 240 }} />
        </div>
      </div>
    );
  }

  function set<K extends keyof Product>(patch: Pick<Product, K>) {
    setProduct((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    setSaving(true);
    try {
      const updated = await api.patch<Product>(`/next-api/admin/shop/products/${id}`, {
        title: product.title,
        slug: product.slug,
        sku: product.sku || null,
        shortDescription: product.shortDescription || null,
        description: product.description || null,
        brand: product.brand || null,
        basePriceCents: product.basePriceCents,
        compareAtPriceCents: (product.variants.find((v) => v.isDefault) ?? product.variants[0])?.compareAtPriceCents ?? null,
        media: product.media.map((m) => ({ key: m.key, type: m.type, posterKey: m.posterKey, altText: m.altText, isFeatured: m.isFeatured })),
        infoSections: product.infoSections,
        trustBadges: product.trustBadges,
        faqs: product.faqs,
        zoomedImages: product.zoomedImages.map((z) => ({ id: z.id, key: z.key, altText: z.altText, sortOrder: z.sortOrder, isActive: z.isActive })),
        packageContents: product.packageContents.map((p) => ({ id: p.id, key: p.key, label: p.label, sortOrder: p.sortOrder, isActive: p.isActive })),
        documents: product.documents,
        privateLinks: product.privateLinks,
        storyGallery: product.storyGallery,
        socialVideos: product.socialVideos,
        socialVideosTitle: product.socialVideosTitle || null,
        storyNarrativeTitle: product.storyNarrativeTitle || null,
        upsellingEnabled: product.upsellingEnabled,
        upsellTiers: product.upsellTiers,
        featured: product.featured,
        isTestProduct: product.isTestProduct,
        freeShipping: product.freeShipping,
        freeShippingDaysMin: product.freeShippingDaysMin,
        freeShippingDaysMax: product.freeShippingDaysMax,
        freeShippingUpgradeMethodIds: product.freeShipping ? (product.freeShippingUpgradeMethods ?? []).map((m) => m.id) : [],
        shippingMethodIds: (product.shippingMethods ?? []).map((m) => m.id),
        primaryCategoryId: product.primaryCategoryId || null,
        categoryIds: product.categories.map((c) => c.id),
        tagIds: product.tags.map((t) => t.id),
      });

      const fields = [
        "title",
        "shortDescription",
        "description",
        "socialVideosTitle",
        "storyNarrativeTitle",
        ...product.faqs.flatMap((f) => [`faq:${f.id}:question`, `faq:${f.id}:answer`]),
        ...product.trustBadges.flatMap((b) => [`trustBadge:${b.id}:title`, `trustBadge:${b.id}:subtitle`]),
        ...product.infoSections.flatMap((s) => [`infoSection:${s.id}:label`, `infoSection:${s.id}:value`]),
        ...product.storyGallery.flatMap((s) => [`storyItem:${s.id}:title`, `storyItem:${s.id}:description`]),
        ...product.documents.map((d) => `document:${d.id}:title`),
        ...product.socialVideos.map((v) => `socialVideo:${v.id}:title`),
      ];
      await saveTranslations(id, fields);

      setProduct(updated);
      setInventory((prev) => prev); // no-op, keep current inventory display
      toast.success("Changes saved");
    } catch (err) {
      toast.error(errMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const updated = await api.post<Product>(`/next-api/admin/shop/products/${id}/publish`);
      setProduct(updated);
      toast.success("Product published");
    } catch (err) {
      toast.error(errMessage(err, "Publish failed"));
    } finally {
      setPublishing(false);
    }
  }
  async function handleArchive() {
    setPublishing(true);
    try {
      const updated = await api.post<Product>(`/next-api/admin/shop/products/${id}/archive`);
      setProduct(updated);
      toast.success("Product archived");
    } catch (err) {
      toast.error(errMessage(err, "Archive failed"));
    } finally {
      setPublishing(false);
    }
  }
  async function handleDelete() {
    if (!confirm("Move this product to Trash? It can be restored later.")) return;
    try {
      await api.delete(`/next-api/admin/shop/products/${id}`);
      toast.success("Product deleted");
      router.push("/admin/shop/products");
    } catch (err) {
      toast.error(errMessage(err, "Delete failed"));
    }
  }

  function toggleCategory(cid: string) {
    if (!product) return;
    const has = product.categories.some((c) => c.id === cid);
    const cat = categories.find((c) => c.id === cid);
    if (!cat) return;
    set({ categories: has ? product.categories.filter((c) => c.id !== cid) : [...product.categories, cat] });
  }

  async function handleAdjustStock() {
    const defaultVariant = product?.variants.find((v) => v.isDefault) ?? product?.variants[0];
    if (!defaultVariant || !stockDelta) return;
    const delta = parseInt(stockDelta, 10);
    if (isNaN(delta) || delta === 0) return;
    setAdjusting(true);
    try {
      const updated = await api.post<Inventory>(`/next-api/admin/shop/inventory/${defaultVariant.id}/adjust`, { delta, note: stockNote || undefined });
      setInventory(updated);
      setStockDelta("");
      setStockNote("");
      toast.success(`Stock adjusted by ${delta > 0 ? "+" : ""}${delta}`);
    } catch (err) {
      toast.error(errMessage(err, "Failed to adjust stock"));
    } finally {
      setAdjusting(false);
    }
  }

  async function handleUpdateThreshold(value: number) {
    const defaultVariant = product?.variants.find((v) => v.isDefault) ?? product?.variants[0];
    if (!defaultVariant) return;
    await api.patch(`/next-api/admin/shop/inventory/${defaultVariant.id}`, { lowStockThreshold: value });
  }


  // ── Product-level attribute scoping ──────────────────────────────────────

  const linkedAttrIds = new Set(productAttrs.map((pa) => pa.attributeId));
  const unlinkedAttrs = attributes.filter((a) => a.isActive !== false && !linkedAttrIds.has(a.id));

  async function generateCombinations(silent = false): Promise<void> {
    try {
      const data = await api.post<{ created: number; skipped: number; deleted: number }>(`/next-api/admin/shop/products/${id}/variants/generate-combinations`);
      const hasActivity = data.created > 0 || data.deleted > 0;
      if (!silent || hasActivity) {
        const parts = [`${data.created} SKU${data.created !== 1 ? "s" : ""} created`];
        if (data.skipped > 0) parts.push(`${data.skipped} already existed`);
        if (data.deleted > 0) parts.push(`${data.deleted} stale SKU${data.deleted !== 1 ? "s" : ""} removed`);
        toast.success(parts.join(", "));
      }
      await load();
    } catch (err) {
      if (!silent) toast.error(errMessage(err, "Failed to generate combinations"));
    }
  }

  async function linkAttribute() {
    if (!attrLinkId) return;
    const selectedAttr = attributes.find((a) => a.id === attrLinkId);
    const activeOvs = (selectedAttr?.optionValues ?? []).filter((v) => v.isActive !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (activeOvs.length > 0 && !attrLinkDefaultId) {
      toast.error("Please select a default option before adding");
      return;
    }
    setAttrLinking(true);
    try {
      await api.post(`/next-api/admin/shop/products/${id}/attributes`, {
        attributeId: attrLinkId,
        defaultOptionValueId: attrLinkDefaultId || null,
      });
      setAttrLinkId("");
      setAttrLinkDefaultId("");
      toast.success("Variation added to product");
      await generateCombinations(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Already linked — just refresh so the list reflects reality.
        setAttrLinkId("");
        setAttrLinkDefaultId("");
        toast.success("Variation already linked — list refreshed");
        await load();
      } else {
        toast.error(errMessage(err, "Failed to add variation"));
      }
    } finally {
      setAttrLinking(false);
    }
  }

  async function updateDefaultOption(attributeId: string, defaultOptionValueId: string | null) {
    try {
      await api.patch(`/next-api/admin/shop/products/${id}/attributes/${attributeId}`, { defaultOptionValueId });
      setProductAttrs((prev) => prev.map((pa) => (pa.attributeId === attributeId ? { ...pa, defaultOptionValueId } : pa)));
      toast.success("Default option updated");
    } catch (err) {
      toast.error(errMessage(err, "Failed to update default option"));
    }
  }

  async function unlinkAttribute(attributeId: string, attrName: string) {
    if (!confirm(`Remove "${attrName}" from this product? All generated SKUs and inventory entries for this variation will be deleted.`)) return;
    try {
      const data = await api.delete<{ deletedVariants: number }>(`/next-api/admin/shop/products/${id}/attributes/${attributeId}`);
      setProductAttrs((prev) => prev.filter((pa) => pa.attributeId !== attributeId));
      toast.success(data.deletedVariants > 0 ? `Removed "${attrName}" — ${data.deletedVariants} SKU${data.deletedVariants !== 1 ? "s" : ""} and their inventory deleted` : `Removed "${attrName}"`);
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to remove variation"));
    }
  }

  // ── Per-product option images ────────────────────────────────────────────

  async function setOptionImage(optionValueId: string, mediaKey: string) {
    try {
      const saved = await api.put<OptionImage>(`/next-api/admin/shop/products/${id}/option-images/${optionValueId}`, { mediaKey });
      setOptionImages((prev) => [...prev.filter((oi) => oi.optionValueId !== optionValueId), saved]);
      toast.success("Image updated");
    } catch (err) {
      toast.error(errMessage(err, "Failed to set image"));
    }
    setOptionImagePickerTarget(null);
  }

  async function removeOptionImage(optionValueId: string) {
    try {
      await api.delete(`/next-api/admin/shop/products/${id}/option-images/${optionValueId}`);
      setOptionImages((prev) => prev.filter((oi) => oi.optionValueId !== optionValueId));
      toast.success("Image removed");
    } catch (err) {
      toast.error(errMessage(err, "Failed to remove image"));
    }
  }

  const isSimpleProduct = productAttrs.length === 0;

  return (
    <div className={styles.page}>
      {/* ── Sticky topbar ── */}
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <Link href="/admin/shop/products" className={styles.backBtn}>
            ← Products
          </Link>
          <span className={styles.topbarTitle}>{product.title || "Untitled product"}</span>
        </div>
        <div className={styles.topbarActions}>
          <button type="button" className={styles.deleteBtn} onClick={handleDelete} disabled={saving || publishing}>
            Delete
          </button>
          {product.status !== "active" && (
            <button type="button" className={styles.publishBtn} onClick={handlePublish} disabled={saving || publishing}>
              {publishing ? "Publishing…" : "Publish"}
            </button>
          )}
          {product.status === "active" && (
            <button type="button" className={styles.publishBtn} onClick={handleArchive} disabled={saving || publishing} style={{ background: "#64748b", borderColor: "#64748b" }}>
              {publishing ? "Archiving…" : "Archive"}
            </button>
          )}
          <button type="submit" form="product-form" className={styles.saveBtn} disabled={saving || publishing}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <form id="product-form" onSubmit={handleSave} className={styles.body}>
        {/* ── Left column ── */}
        <div>
          {/* Content */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionIcon}>
                <Pencil size={15} />
              </span>
              <span className={styles.sectionTitle}>Content</span>
            </div>
            <div className={styles.sectionBody}>
              <BilingualField
                label="Title"
                field="title"
                baseValue={product.title}
                baseOnChange={(v) => set({ title: v })}
                baseRequired
                translations={translations}
                onTranslationChange={setTranslation}
                onGenerate={() => applyPlainGenerate(titleGen, product.title, "title")}
                generating={titleGen.generating}
                generateError={titleGen.error ?? genErrors.title ?? null}
              />
              <div className={styles.fieldRow} style={{ marginTop: 16 }}>
                <div className={styles.field}>
                  <label className={styles.label}>Slug</label>
                  <input className={styles.input} value={product.slug} onChange={(e) => set({ slug: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Brand</label>
                  <input className={styles.input} value={product.brand ?? ""} onChange={(e) => set({ brand: e.target.value })} />
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <BilingualField
                  label="Short description"
                  field="shortDescription"
                  baseValue={product.shortDescription ?? ""}
                  baseOnChange={(v) => set({ shortDescription: v })}
                  translations={translations}
                  onTranslationChange={setTranslation}
                  multiline
                  rows={2}
                  onGenerate={() => applyPlainGenerate(shortDescGen, product.shortDescription ?? "", "shortDescription")}
                  generating={shortDescGen.generating}
                  generateError={shortDescGen.error ?? genErrors.shortDescription ?? null}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <BilingualField
                  label="Description"
                  field="description"
                  baseValue={product.description ?? ""}
                  baseOnChange={(v) => set({ description: v })}
                  translations={translations}
                  onTranslationChange={setTranslation}
                  richText
                  onGenerate={() => applyPlainGenerate(descGen, product.description ?? "", "description")}
                  generating={descGen.generating}
                  generateError={descGen.error ?? genErrors.description ?? null}
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionIcon}>
                <DollarSign size={15} />
              </span>
              <span className={styles.sectionTitle}>Pricing</span>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Base price (€) <span className={styles.required}>*</span>
                  </label>
                  <input
                    className={styles.input}
                    type="number"
                    step="0.01"
                    min="0"
                    value={eur(product.basePriceCents)}
                    onChange={(e) => set({ basePriceCents: toCents(e.target.value) ?? 0 })}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Compare-at price (€)</label>
                  <input
                    className={styles.input}
                    type="number"
                    step="0.01"
                    min="0"
                    value={eur((product.variants.find((v) => v.isDefault) ?? product.variants[0])?.compareAtPriceCents ?? null)}
                    onChange={(e) => {
                      const dv = product.variants.find((v) => v.isDefault) ?? product.variants[0];
                      if (!dv) return;
                      const compareAtPriceCents = toCents(e.target.value);
                      set({ variants: product.variants.map((v) => (v.id === dv.id ? { ...v, compareAtPriceCents } : v)) });
                    }}
                    placeholder="49.99 (optional)"
                  />
                  <span className={styles.hint}>Shown as crossed-out original price</span>
                </div>
              </div>
            </div>
          </div>

          {/* Media */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionIcon}>
                <ImageIcon size={15} />
              </span>
              <span className={styles.sectionTitle}>Media</span>
            </div>
            <div className={styles.sectionBody}>
              <ProductMediaManager initialMedia={product.media} onChange={(media) => set({ media: media as ResolvedProductMediaItem[] })} />
            </div>
          </div>

          {/* Specifications */}
          <CollapsibleSection icon={<ClipboardList size={15} />} title="Specifications">
            <ProductInfoSectionsManager
              initialSections={product.infoSections}
              translations={translations}
              onTranslationChange={setTranslation}
              onChange={(infoSections) => set({ infoSections })}
            />
          </CollapsibleSection>

          {/* Zoomed images */}
          <CollapsibleSection icon={<ZoomIn size={15} />} title="Zoomed images">
            <ProductZoomedImagesManager initialItems={product.zoomedImages} onChange={(zoomedImages) => set({ zoomedImages: zoomedImages as ResolvedProductZoomedImage[] })} />
          </CollapsibleSection>

          {/* Package contents */}
          <CollapsibleSection icon={<Package size={15} />} title="Package contents">
            <ProductPackageContentsManager
              initialItems={product.packageContents}
              onChange={(packageContents) => set({ packageContents: packageContents as ResolvedProductPackageContentItem[] })}
            />
          </CollapsibleSection>

          {/* Trust badges */}
          <CollapsibleSection icon={<Shield size={15} />} title="Trust badges">
            <ProductTrustBadgesManager
              initialBadges={product.trustBadges}
              translations={translations}
              onTranslationChange={setTranslation}
              onChange={(trustBadges) => set({ trustBadges })}
            />
          </CollapsibleSection>

          {/* FAQs */}
          <CollapsibleSection icon={<HelpCircle size={15} />} title="FAQs">
            <ProductFaqsManager initialFaqs={product.faqs} translations={translations} onTranslationChange={setTranslation} onChange={(faqs) => set({ faqs })} />
          </CollapsibleSection>

          {/* Documents */}
          <CollapsibleSection icon={<FileText size={15} />} title="Documents (PDF)">
            <ProductDocumentsManager
              productId={product.id}
              initialDocuments={product.documents}
              translations={translations}
              onTranslationChange={setTranslation}
              onChange={(documents) => set({ documents })}
            />
          </CollapsibleSection>

          {/* Private links */}
          <CollapsibleSection icon={<Lock size={15} />} title="Private links">
            <ProductPrivateLinksManager initialLinks={product.privateLinks} onChange={(privateLinks) => set({ privateLinks })} />
          </CollapsibleSection>

          {/* Story gallery */}
          <CollapsibleSection icon={<GalleryHorizontalEnd size={15} />} title="Story gallery">
            <div style={{ marginBottom: 16 }}>
              <BilingualField
                label="Narrative section title"
                field="storyNarrativeTitle"
                baseValue={product.storyNarrativeTitle ?? ""}
                baseOnChange={(v) => set({ storyNarrativeTitle: v })}
                translations={translations}
                onTranslationChange={setTranslation}
                onGenerate={() => applyPlainGenerate(storyTitleGen, product.storyNarrativeTitle ?? "", "storyNarrativeTitle")}
                generating={storyTitleGen.generating}
                generateError={storyTitleGen.error ?? genErrors.storyNarrativeTitle ?? null}
              />
            </div>
            <ProductStoryGalleryManager
              initialItems={product.storyGallery}
              translations={translations}
              onTranslationChange={setTranslation}
              onChange={(storyGallery) => set({ storyGallery })}
            />
          </CollapsibleSection>

          {/* Social videos */}
          <CollapsibleSection icon={<Clapperboard size={15} />} title="Social videos">
            <div style={{ marginBottom: 16 }}>
              <BilingualField
                label="Section title"
                field="socialVideosTitle"
                baseValue={product.socialVideosTitle ?? ""}
                baseOnChange={(v) => set({ socialVideosTitle: v })}
                translations={translations}
                onTranslationChange={setTranslation}
                onGenerate={() => applyPlainGenerate(socialTitleGen, product.socialVideosTitle ?? "", "socialVideosTitle")}
                generating={socialTitleGen.generating}
                generateError={socialTitleGen.error ?? genErrors.socialVideosTitle ?? null}
              />
            </div>
            <ProductSocialVideosManager
              initialVideos={product.socialVideos}
              translations={translations}
              onTranslationChange={setTranslation}
              onChange={(socialVideos) => set({ socialVideos })}
            />
          </CollapsibleSection>

          {/* Quantity discounts */}
          <CollapsibleSection icon={<Layers size={15} />} title="Quantity discounts (upselling)">
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13.5 }}>
              <input type="checkbox" checked={product.upsellingEnabled} onChange={(e) => set({ upsellingEnabled: e.target.checked })} />
              Enable quantity discounts
            </label>
            {product.upsellingEnabled && (
              <ProductUpsellTiersManager
                initialTiers={product.upsellTiers}
                basePriceCents={product.basePriceCents ?? 0}
                onChange={(upsellTiers) => set({ upsellTiers })}
              />
            )}
          </CollapsibleSection>

          {/* Variations — which attributes (Color, Size…) this product uses */}
          <CollapsibleSection icon={<Palette size={15} />} title="Variations" last>
            {productAttrs.length > 0 && (
              <button type="button" onClick={() => generateCombinations(false)} className={styles.saveBtn} style={{ fontSize: 12, padding: "5px 12px", marginBottom: 14 }}>
                Generate combinations
              </button>
            )}

            {productAttrs.length === 0 ? (
              <p className={styles.hint} style={{ marginBottom: 16 }}>
                No variations linked. Add a variation below — customers will see its options when choosing.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
                {[...productAttrs]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((pa) => {
                    const activeOvs = [...pa.attribute.optionValues].filter((v) => v.isActive !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                    return (
                      <div key={pa.id} style={{ border: "1px solid var(--color-surface)", borderRadius: 10, padding: "12px 14px", background: "var(--color-surface-tint)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)" }}>{pa.attribute.name}</span>
                            {pa.attribute.adminLabel && <span className={styles.hint}>{pa.attribute.adminLabel}</span>}
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                background: "var(--background)",
                                border: "1px solid var(--color-surface)",
                                borderRadius: 5,
                                padding: "1px 7px",
                                color: "color-mix(in srgb, var(--foreground) 45%, transparent)",
                                textTransform: "capitalize",
                              }}
                            >
                              {pa.attribute.displayType}
                            </span>
                          </div>
                          <button type="button" onClick={() => unlinkAttribute(pa.attributeId, attrLabel(pa.attribute))} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>
                            Remove
                          </button>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                          {activeOvs.length === 0 ? (
                            <span className={styles.optionChipNone}>No option values defined</span>
                          ) : (
                            activeOvs.map((ov) => {
                              const optImg = ov.swatchType === "image" ? optionImages.find((oi) => oi.optionValueId === ov.id) : undefined;
                              const isDefault = pa.defaultOptionValueId === ov.id;
                              return (
                                <span
                                  key={ov.id}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    background: "var(--background)",
                                    border: isDefault ? "2px solid var(--color-primary)" : "1px solid var(--color-surface)",
                                    borderRadius: 8,
                                    padding: "3px 10px",
                                    color: "var(--foreground)",
                                  }}
                                >
                                  {ov.swatchValue && ov.swatchType === "color" && <span style={{ width: 12, height: 12, borderRadius: "50%", background: ov.swatchValue, border: "1px solid rgba(0,0,0,.15)", flexShrink: 0 }} />}
                                  {ov.swatchType === "image" && (
                                    <span
                                      style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 4,
                                        overflow: "hidden",
                                        flexShrink: 0,
                                        background: "var(--color-surface-tint)",
                                        border: "1px solid var(--color-surface)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      {optImg?.url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={optImg.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                      ) : (
                                        <ImagePlus size={11} style={{ color: "color-mix(in srgb, var(--foreground) 45%, transparent)" }} />
                                      )}
                                    </span>
                                  )}
                                  {ov.displayValue ?? ov.value}
                                  {isDefault && (
                                    <span style={{ fontSize: 10, color: "var(--color-primary)", fontWeight: 700 }} className={styles.defaultBadge}>
                                      default
                                    </span>
                                  )}
                                  {ov.swatchType === "image" && (
                                    <span style={{ display: "inline-flex", gap: 4 }}>
                                      <button type="button" onClick={() => setOptionImagePickerTarget(ov.id)} style={{ fontSize: 10, fontWeight: 600, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                                        {optImg ? "Change" : "Set image"}
                                      </button>
                                      {optImg && (
                                        <button type="button" onClick={() => removeOptionImage(ov.id)} style={{ fontSize: 10, fontWeight: 600, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                                          Remove
                                        </button>
                                      )}
                                    </span>
                                  )}
                                </span>
                              );
                            })
                          )}
                        </div>

                        {activeOvs.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <label className={styles.hint} style={{ whiteSpace: "nowrap", margin: 0 }}>
                              Default option:
                            </label>
                            <select className={styles.select} style={{ fontSize: 12, padding: "3px 8px", flex: 1 }} value={pa.defaultOptionValueId ?? ""} onChange={(e) => updateDefaultOption(pa.attributeId, e.target.value || null)}>
                              <option value="">— none —</option>
                              {activeOvs.map((ov) => (
                                <option key={ov.id} value={ov.id}>
                                  {ov.displayValue ?? ov.value}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {unlinkedAttrs.length > 0 &&
              (() => {
                const selectedAttrForLink = attributes.find((a) => a.id === attrLinkId);
                const linkActiveOvs = (selectedAttrForLink?.optionValues ?? []).filter((v) => v.isActive !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select
                        className={styles.select}
                        value={attrLinkId}
                        onChange={(e) => {
                          setAttrLinkId(e.target.value);
                          setAttrLinkDefaultId("");
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">— Add a variation (Color, Size…) —</option>
                        {unlinkedAttrs.map((a) => (
                          <option key={a.id} value={a.id}>
                            {attrLabel(a)}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={linkAttribute} disabled={!attrLinkId || attrLinking} className={styles.saveBtn} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                        {attrLinking ? "Adding…" : "Add"}
                      </button>
                    </div>
                    {attrLinkId && linkActiveOvs.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <label className={styles.hint} style={{ whiteSpace: "nowrap", margin: 0 }}>
                          Default option:
                        </label>
                        <select className={styles.select} style={{ fontSize: 12, padding: "3px 8px", flex: 1 }} value={attrLinkDefaultId} onChange={(e) => setAttrLinkDefaultId(e.target.value)}>
                          <option value="">— Select default option —</option>
                          {linkActiveOvs.map((ov) => (
                            <option key={ov.id} value={ov.id}>
                              {ov.displayValue ?? ov.value}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })()}

            {unlinkedAttrs.length === 0 && productAttrs.length > 0 && (
              <p className={styles.hint} style={{ marginTop: 8 }}>
                All available variations are linked to this product.
              </p>
            )}
          </CollapsibleSection>
        </div>

        {/* ── Right column / sidebar ── */}
        <div>
          {/* Status & Visibility */}
          <div className={styles.sidebarCard}>
            <div className={styles.sidebarCardHead}>
              <span className={styles.sidebarCardTitle}>Status &amp; Visibility</span>
            </div>
            <div className={styles.sidebarCardBody}>
              <div className={styles.field}>
                <label className={styles.label}>Status</label>
                <select className={styles.select} value={product.status} onChange={(e) => set({ status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
              <div className={styles.divider} />
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Featured</div>
                  <div className={styles.toggleNote}>Show in featured sections</div>
                </div>
                <input type="checkbox" checked={product.featured} onChange={(e) => set({ featured: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--color-accent)", cursor: "pointer" }} />
              </div>
              <div className={styles.divider} />
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Test product</div>
                  <div className={styles.toggleNote}>
                    Measures demand before you order stock. Customers can browse, add to cart and enter shipping, but checkout fails at the payment step. Results appear under Test Products.
                  </div>
                </div>
                <input type="checkbox" checked={product.isTestProduct} onChange={(e) => set({ isTestProduct: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--color-accent)", cursor: "pointer" }} />
              </div>
              {product.isTestProduct && (
                <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px" }}>
                  This product cannot be sold. The payment form never loads and no charge is ever created — customers see a generic error at the shipping step.
                </p>
              )}
              {optInMethods.length > 0 && (
                <>
                  <div className={styles.divider} />
                  <div className={styles.field} style={{ marginBottom: 0 }}>
                    <label className={styles.label}>Shipping methods</label>
                    <p className={styles.hint} style={{ marginTop: 0 }}>
                      Methods that have to be enabled product by product. A basket is offered one of these only when{" "}
                      <strong>every</strong> product in it allows the method — one product left unticked withdraws it from the whole order.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--color-surface)", borderRadius: 10, padding: "10px 12px", maxHeight: 220, overflowY: "auto" }}>
                      {optInMethods.map((m) => {
                        const checked = (product.shippingMethods ?? []).some((x) => x.id === m.id);
                        return (
                          <label key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer", fontSize: 13 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                set({
                                  shippingMethods: checked
                                    ? (product.shippingMethods ?? []).filter((x) => x.id !== m.id)
                                    : [...(product.shippingMethods ?? []), { id: m.id }],
                                })
                              }
                              style={{ width: 15, height: 15, marginTop: 2, accentColor: "var(--color-accent)", cursor: "pointer" }}
                            />
                            <span>
                              <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>{m.name}</span>
                              <span className={styles.hint}>
                                {" "}
                                — €{(m.priceCents / 100).toFixed(2)} · {m.estimatedDaysMin}–{m.estimatedDaysMax} days
                              </span>
                              {m.supportedCountryCodes?.length > 0 && (
                                <span className={styles.hint} style={{ display: "block", fontSize: 11.5 }}>
                                  Delivers to: {m.supportedCountryCodes.join(", ")} — not offered for any other destination
                                </span>
                              )}
                              {!m.isActive && (
                                <span
                                  style={{
                                    display: "block",
                                    marginTop: 4,
                                    padding: "5px 8px",
                                    borderRadius: 6,
                                    background: "var(--color-warning-bg)",
                                    border: "1px solid var(--color-warning-border)",
                                    color: "var(--color-warning)",
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                  }}
                                >
                                  Switched off — ticking it here has no effect until the method itself is activated in Shop → Shipping.
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div className={styles.divider} />
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Free shipping</div>
                  <div className={styles.toggleNote}>
                    Delivery is offered on this product, whatever the order total. A &ldquo;Free shipping&rdquo; badge appears on the listing, the product page and the cart. Applies when the basket contains only free-shipping products.
                  </div>
                </div>
                <input type="checkbox" checked={product.freeShipping} onChange={(e) => set({ freeShipping: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--color-accent)", cursor: "pointer" }} />
              </div>
              {product.freeShipping && (
                <div className={styles.field} style={{ marginTop: 12, marginBottom: 0 }}>
                  <label className={styles.label}>
                    Free delivery time <span className={styles.hint} style={{ fontWeight: 400 }}>(optional)</span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      className={styles.input}
                      style={{ width: 80 }}
                      value={product.freeShippingDaysMin ?? ""}
                      onChange={(e) => set({ freeShippingDaysMin: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="min"
                    />
                    <span>–</span>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      className={styles.input}
                      style={{ width: 80 }}
                      value={product.freeShippingDaysMax ?? ""}
                      onChange={(e) => set({ freeShippingDaysMax: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="max"
                    />
                    <span style={{ fontSize: 13 }}>days</span>
                  </div>
                  <p className={styles.hint}>Shown next to &ldquo;Free shipping&rdquo; at checkout. Leave empty to use the delivery estimate of the customer&rsquo;s shipping zone.</p>
                </div>
              )}
              {product.freeShipping && (
                <div className={styles.field} style={{ marginTop: 12, marginBottom: 0 }}>
                  <label className={styles.label}>
                    Paid faster options <span className={styles.hint} style={{ fontWeight: 400 }}>(optional)</span>
                  </label>
                  {freeShipMethods.length === 0 ? (
                    <p className={styles.hint}>No method is marked &ldquo;Used for free shipping&rdquo; yet — enable that switch on a method in Shop → Shipping to offer one here.</p>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--color-surface)", borderRadius: 10, padding: "10px 12px", maxHeight: 220, overflowY: "auto" }}>
                        {freeShipMethods.map((m) => {
                          const checked = (product.freeShippingUpgradeMethods ?? []).some((x) => x.id === m.id);
                          return (
                            <label key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer", fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  set({
                                    freeShippingUpgradeMethods: checked
                                      ? (product.freeShippingUpgradeMethods ?? []).filter((x) => x.id !== m.id)
                                      : [...(product.freeShippingUpgradeMethods ?? []), { id: m.id }],
                                  })
                                }
                                style={{ width: 15, height: 15, marginTop: 2, accentColor: "var(--color-accent)", cursor: "pointer" }}
                              />
                              <span>
                                <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>{m.name}</span>
                                <span className={styles.hint}>
                                  {" "}
                                  — €{(m.priceCents / 100).toFixed(2)} · {m.estimatedDaysMin}–{m.estimatedDaysMax} days
                                </span>
                                {m.zone && (
                                  <span className={styles.hint} style={{ display: "block", fontSize: 11.5 }}>
                                    Zone: {m.zone.name}
                                    {m.zone.countryCodes && m.zone.countryCodes.length > 0 && ` (${m.zone.countryCodes.join(", ")})`}
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <p className={styles.hint}>Offered next to free shipping at checkout, for customers willing to pay for quicker delivery. Each customer only sees the ones belonging to the shipping zone of their delivery address.</p>
                    </>
                  )}
                </div>
              )}
              {product.freeShipping && (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: "var(--color-primary)",
                    background: "color-mix(in srgb, var(--color-primary) 7%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-primary) 28%, transparent)",
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  Shipping is charged once per order, so it is all or nothing: the order ships free only when <strong>every product in the basket</strong> has free shipping. Add one product with paid delivery and normal shipping applies to the whole order.
                </p>
              )}
            </div>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarCardHead}>
                <span className={styles.sidebarCardTitle}>Categories</span>
              </div>
              <div className={styles.sidebarCardBody}>
                <div className={styles.field}>
                  <label className={styles.label}>Primary category</label>
                  <select className={styles.select} value={product.primaryCategoryId ?? ""} onChange={(e) => set({ primaryCategoryId: e.target.value || null })}>
                    <option value="">— None —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.divider} />
                <label className={styles.label} style={{ display: "block", marginBottom: 8 }}>
                  Additional categories
                </label>
                <div className={styles.categoryList}>
                  {categories.map((c) => (
                    <label key={c.id} className={styles.categoryItem}>
                      <input type="checkbox" checked={product.categories.some((pc) => pc.id === c.id)} onChange={() => toggleCategory(c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
                {tags.length > 0 && (
                  <>
                    <div className={styles.divider} />
                    <label className={styles.label} style={{ display: "block", marginBottom: 8 }}>
                      Tags
                    </label>
                    <div className={styles.categoryList}>
                      {tags.map((t) => (
                        <label key={t.id} className={styles.categoryItem}>
                          <input
                            type="checkbox"
                            checked={product.tags.some((pt) => pt.id === t.id)}
                            onChange={() => set({ tags: product.tags.some((pt) => pt.id === t.id) ? product.tags.filter((pt) => pt.id !== t.id) : [...product.tags, t] })}
                          />
                          {t.name}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Product Info */}
          <div className={styles.sidebarCard}>
            <div className={styles.sidebarCardHead}>
              <span className={styles.sidebarCardTitle}>Product Info</span>
            </div>
            <div className={styles.sidebarCardBody}>
              <div className={styles.toggleRow}>
                <span className={styles.toggleLabel}>SKU</span>
                <span style={{ fontSize: 12, fontFamily: "monospace" }}>{product.sku ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* Inventory — simple products only */}
          {isSimpleProduct && inventory && (
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarCardHead}>
                <span className={styles.sidebarCardTitle}>Inventory</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: inventory.available <= 0 ? "#fee2e2" : inventory.available <= inventory.lowStockThreshold ? "#fef3c7" : "#dcfce7",
                    color: inventory.available <= 0 ? "#dc2626" : inventory.available <= inventory.lowStockThreshold ? "#d97706" : "#16a34a",
                  }}
                >
                  {inventory.available <= 0 ? "Out of stock" : inventory.available <= inventory.lowStockThreshold ? "Low stock" : "In stock"}
                </span>
              </div>
              <div className={styles.sidebarCardBody}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {(["available", "reserved", "committed", "incoming"] as const).map((k) => (
                    <div key={k} style={{ background: "var(--color-surface-tint)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{inventory[k]}</div>
                      <div style={{ fontSize: 11 }} className={styles.hint}>
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.divider} />
                <label className={styles.label} style={{ marginBottom: 6, display: "block" }}>
                  Adjust stock
                </label>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input className={styles.input} type="number" value={stockDelta} onChange={(e) => setStockDelta(e.target.value)} placeholder="+10 or -5" style={{ flex: 1 }} />
                  <button type="button" className={styles.saveBtn} disabled={adjusting || !stockDelta || parseInt(stockDelta, 10) === 0} onClick={handleAdjustStock} style={{ fontSize: 12, padding: "6px 14px" }}>
                    {adjusting ? "…" : "Apply"}
                  </button>
                </div>
                <input className={styles.input} value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="Reason (optional)" style={{ fontSize: 12, marginBottom: 12 }} />
                <div className={styles.divider} />
                <div className={styles.field}>
                  <label className={styles.label}>Low stock alert threshold</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={inventory.lowStockThreshold}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 0) {
                        setInventory((prev) => (prev ? { ...prev, lowStockThreshold: v } : prev));
                        handleUpdateThreshold(v);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </form>

      <ProductImagePicker
        open={optionImagePickerTarget !== null}
        onClose={() => setOptionImagePickerTarget(null)}
        images={product.media.filter((m) => m.type === "image")}
        onSelect={(item) => setOptionImage(optionImagePickerTarget!, item.key)}
        title="Select option image"
      />
    </div>
  );
}
