"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import MediaPicker from "@/components/admin/ui/MediaPicker";
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
import { Pencil, DollarSign, Image as ImageIcon, ClipboardList, Shield, HelpCircle, FileText, GalleryHorizontalEnd, Clapperboard, Layers, ZoomIn, Lock, Package } from "lucide-react";
import styles from "../ProductEdit.module.css";
import ui from "@/components/admin/ui/admin-ui.module.css";

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
}
interface VariantAttribute {
  id: string;
  name: string;
  optionValues: OptionValue[];
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
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
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

const VARIANT_FORM_ID = "variant-form";
const ENTITY_TYPE = "shop_product";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [attributes, setAttributes] = useState<VariantAttribute[]>([]);
  const [freeShipMethods, setFreeShipMethods] = useState<FreeShipMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const { translations, setTranslation, saveTranslations } = useEntityTranslations(ENTITY_TYPE, product?.id ?? null);

  const [variantModal, setVariantModal] = useState<{ id: string | null; selections: Record<string, string>; priceCents: string; compareAtPriceCents: string; sku: string; initialStock: string } | null>(null);
  const [variantSaving, setVariantSaving] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [stockDelta, setStockDelta] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, cats, tgs, attrs, fsm] = await Promise.all([
      api.get<Product>(`/next-api/admin/shop/products/${id}`),
      api.get<Category[]>("/next-api/admin/shop/categories"),
      api.get<Tag[]>("/next-api/admin/shop/tags"),
      api.get<VariantAttribute[]>("/next-api/admin/shop/variant-attributes"),
      api.get<FreeShipMethod[]>("/next-api/admin/shop/shipping/free-shipping-methods").catch(() => []),
    ]);
    setProduct(p);
    setCategories(cats);
    setTags(tgs);
    setAttributes(attrs);
    setFreeShipMethods(fsm);
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
    setError(null);
    try {
      const updated = await api.patch<Product>(`/next-api/admin/shop/products/${id}`, {
        title: product.title,
        slug: product.slug,
        sku: product.sku || null,
        shortDescription: product.shortDescription || null,
        description: product.description || null,
        brand: product.brand || null,
        basePriceCents: product.basePriceCents,
        featuredImageKey: product.featuredImageKey || null,
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
        seoTitle: product.seoTitle || null,
        seoDescription: product.seoDescription || null,
        canonicalUrl: product.canonicalUrl || null,
        featured: product.featured,
        isTestProduct: product.isTestProduct,
        freeShipping: product.freeShipping,
        freeShippingDaysMin: product.freeShippingDaysMin,
        freeShippingDaysMax: product.freeShippingDaysMax,
        freeShippingUpgradeMethodIds: product.freeShipping ? (product.freeShippingUpgradeMethods ?? []).map((m) => m.id) : [],
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
      setSavedAt(Date.now());
    } catch (err) {
      setError(errMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    const updated = await api.post<Product>(`/next-api/admin/shop/products/${id}/publish`);
    setProduct(updated);
  }
  async function handleArchive() {
    const updated = await api.post<Product>(`/next-api/admin/shop/products/${id}/archive`);
    setProduct(updated);
  }
  async function handleDelete() {
    if (!confirm("Move this product to Trash? It can be restored later.")) return;
    await api.delete(`/next-api/admin/shop/products/${id}`);
    router.push("/admin/shop/products");
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
    } finally {
      setAdjusting(false);
    }
  }

  async function handleUpdateThreshold(value: number) {
    const defaultVariant = product?.variants.find((v) => v.isDefault) ?? product?.variants[0];
    if (!defaultVariant) return;
    await api.patch(`/next-api/admin/shop/inventory/${defaultVariant.id}`, { lowStockThreshold: value });
  }

  // ── Variant modal handlers (existing simple attribute-selection flow) ───
  function openNewVariant() {
    setVariantError(null);
    setVariantModal({ id: null, selections: {}, priceCents: "", compareAtPriceCents: "", sku: "", initialStock: "0" });
  }
  function openEditVariant(v: Variant) {
    setVariantError(null);
    const selections: Record<string, string> = {};
    for (const o of v.options) if (o.optionValue) selections[o.attributeId] = o.optionValue.id;
    setVariantModal({ id: v.id, selections, priceCents: eur(v.priceCents), compareAtPriceCents: eur(v.compareAtPriceCents), sku: v.sku, initialStock: "" });
  }
  async function handleVariantSubmit(e: FormEvent) {
    e.preventDefault();
    if (!variantModal) return;
    setVariantSaving(true);
    setVariantError(null);
    const options = Object.values(variantModal.selections)
      .filter(Boolean)
      .map((optionValueId) => ({ optionValueId }));
    const payload = {
      sku: variantModal.sku || undefined,
      priceCents: toCents(variantModal.priceCents),
      compareAtPriceCents: toCents(variantModal.compareAtPriceCents),
      options,
      ...(variantModal.id ? {} : { initialStock: Number(variantModal.initialStock || 0) }),
    };
    try {
      if (variantModal.id) {
        await api.patch(`/next-api/admin/shop/products/${id}/variants/${variantModal.id}`, payload);
      } else {
        await api.post(`/next-api/admin/shop/products/${id}/variants`, payload);
      }
      setVariantModal(null);
      await load();
    } catch (err) {
      setVariantError(errMessage(err, "Could not save variant"));
    } finally {
      setVariantSaving(false);
    }
  }
  async function handleDeleteVariant(variantId: string) {
    if (!confirm("Delete this variant?")) return;
    await api.delete(`/next-api/admin/shop/products/${id}/variants/${variantId}`);
    await load();
  }

  const isSimpleProduct = product.variants.length <= 1;

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
          {error && <span className={ui.error}>{error}</span>}
          {savedAt && !error && <span style={{ color: "#166534", fontSize: 13 }}>Saved.</span>}
          <button type="button" className={styles.deleteBtn} onClick={handleDelete}>
            Delete
          </button>
          {product.status !== "active" && (
            <button type="button" className={styles.publishBtn} onClick={handlePublish}>
              Publish
            </button>
          )}
          {product.status === "active" && (
            <button type="button" className={styles.publishBtn} onClick={handleArchive} style={{ background: "#64748b", borderColor: "#64748b" }}>
              Archive
            </button>
          )}
          <button type="submit" form="product-form" className={styles.saveBtn} disabled={saving}>
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
              <div className={styles.field} style={{ marginBottom: 16 }}>
                <label className={styles.label}>Featured image</label>
                <MediaPicker
                  value={product.featuredImageKey}
                  previewUrl={product.featuredImageUrl}
                  onChange={(key, url) => set({ featuredImageKey: key, featuredImageUrl: url })}
                  label="featured image"
                />
              </div>
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

          {/* SEO */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionIcon}>
                <Pencil size={15} />
              </span>
              <span className={styles.sectionTitle}>SEO</span>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.field}>
                <label className={styles.label}>SEO title</label>
                <input className={styles.input} value={product.seoTitle ?? ""} onChange={(e) => set({ seoTitle: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>SEO description</label>
                <textarea className={styles.textarea} value={product.seoDescription ?? ""} onChange={(e) => set({ seoDescription: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Canonical URL</label>
                <input className={styles.input} value={product.canonicalUrl ?? ""} onChange={(e) => set({ canonicalUrl: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Variants */}
          <div className={styles.section} style={{ marginBottom: 0 }}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionIcon}>
                <Layers size={15} />
              </span>
              <span className={styles.sectionTitle}>Variants</span>
              <button type="button" className={styles.sectionHeadAction} onClick={openNewVariant}>
                Add variant
              </button>
            </div>
            <div className={styles.sectionBodyNoPad}>
              {product.variants.length === 0 ? (
                <p className={styles.hint} style={{ padding: 20 }}>
                  No variants yet.
                </p>
              ) : (
                <table className={styles.variantsTable}>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>SKU</th>
                      <th>Options</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((v) => (
                      <tr key={v.id}>
                        <td>
                          {v.title} {v.isDefault && <span className={styles.defaultBadge}>default</span>}
                        </td>
                        <td>{v.sku}</td>
                        <td>
                          <div className={styles.optionChips}>
                            {v.options.length === 0 ? (
                              <span className={styles.optionChipNone}>—</span>
                            ) : (
                              v.options.map((o) => (
                                <span key={o.attributeId} className={styles.optionChip}>
                                  <span className={styles.optionChipAttr}>{o.attribute.name}:</span> {o.optionValue?.displayValue ?? o.value}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className={styles.variantPrice}>
                          {v.priceCents !== null ? `€${(v.priceCents / 100).toFixed(2)}` : `€${((product.basePriceCents ?? 0) / 100).toFixed(2)} (base)`}
                        </td>
                        <td>{v.inventoryItem?.available ?? 0}</td>
                        <td>
                          <button type="button" className={styles.variantEditBtn} onClick={() => openEditVariant(v)}>
                            Edit
                          </button>
                          <button type="button" className={styles.variantDeleteBtn} onClick={() => handleDeleteVariant(v.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
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
                    Measures demand before you order stock. Customers can browse, add to cart and enter shipping, but checkout fails at the payment step.
                  </div>
                </div>
                <input type="checkbox" checked={product.isTestProduct} onChange={(e) => set({ isTestProduct: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--color-accent)", cursor: "pointer" }} />
              </div>
              {product.isTestProduct && (
                <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px" }}>
                  This product cannot be sold. The payment form never loads and no charge is ever created.
                </p>
              )}
              <div className={styles.divider} />
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Free shipping</div>
                  <div className={styles.toggleNote}>
                    Delivery is offered on this product. A &ldquo;Free shipping&rdquo; badge appears on the listing, product page and cart.
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
                </div>
              )}
              {product.freeShipping && (
                <div className={styles.field} style={{ marginTop: 12, marginBottom: 0 }}>
                  <label className={styles.label}>
                    Paid faster options <span className={styles.hint} style={{ fontWeight: 400 }}>(optional)</span>
                  </label>
                  {freeShipMethods.length === 0 ? (
                    <p className={styles.hint}>No method is marked &ldquo;available for free shipping&rdquo; yet.</p>
                  ) : (
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
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
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

      {variantModal && (
        <Modal
          title={variantModal.id ? "Edit variant" : "Add variant"}
          onClose={() => setVariantModal(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setVariantModal(null)}>
                Cancel
              </Button>
              <Button type="submit" form={VARIANT_FORM_ID} disabled={variantSaving}>
                {variantSaving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <form id={VARIANT_FORM_ID} onSubmit={handleVariantSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {variantError && <p className={ui.error}>{variantError}</p>}
            {attributes.length === 0 ? (
              <p style={{ color: "var(--color-secondary)", fontSize: "0.85rem" }}>No variant attributes defined yet — this will be a single (no-option) variant.</p>
            ) : (
              attributes.map((attr) => (
                <div className={ui.field} key={attr.id}>
                  <label className={ui.label}>{attr.name}</label>
                  <select
                    className={ui.select}
                    value={variantModal.selections[attr.id] ?? ""}
                    onChange={(e) => setVariantModal({ ...variantModal, selections: { ...variantModal.selections, [attr.id]: e.target.value } })}
                  >
                    <option value="">—</option>
                    {attr.optionValues.map((ov) => (
                      <option key={ov.id} value={ov.id}>
                        {ov.displayValue ?? ov.value}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>SKU (optional)</label>
                <input className={ui.input} value={variantModal.sku} onChange={(e) => setVariantModal({ ...variantModal, sku: e.target.value })} />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Price override (€, optional)</label>
                <input
                  className={ui.input}
                  type="number"
                  step="0.01"
                  value={variantModal.priceCents}
                  onChange={(e) => setVariantModal({ ...variantModal, priceCents: e.target.value })}
                  placeholder="uses base price"
                />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Compare-at price (€, optional)</label>
                <input
                  className={ui.input}
                  type="number"
                  step="0.01"
                  value={variantModal.compareAtPriceCents}
                  onChange={(e) => setVariantModal({ ...variantModal, compareAtPriceCents: e.target.value })}
                />
              </div>
              {!variantModal.id && (
                <div className={ui.field}>
                  <label className={ui.label}>Initial stock</label>
                  <input className={ui.input} type="number" min="0" value={variantModal.initialStock} onChange={(e) => setVariantModal({ ...variantModal, initialStock: e.target.value })} />
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
