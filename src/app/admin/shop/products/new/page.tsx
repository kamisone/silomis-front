"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import BilingualField from "@/components/admin/BilingualField";
import CollapsibleSection from "@/components/admin/shop/CollapsibleSection";
import ProductMediaManager from "@/components/admin/shop/ProductMediaManager";
import ProductInfoSectionsManager from "@/components/admin/shop/ProductInfoSectionsManager";
import ProductTrustBadgesManager from "@/components/admin/shop/ProductTrustBadgesManager";
import ProductFaqsManager from "@/components/admin/shop/ProductFaqsManager";
import { useEntityTranslations } from "@/hooks/useEntityTranslations";
import { useSectionGenerate } from "@/hooks/useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import type { ResolvedProductMediaItem, ProductInfoSection, ProductTrustBadge, ProductFaq } from "@/lib/shop/productContent.types";
import { Pencil, DollarSign, Image as ImageIcon, ClipboardList, Shield, HelpCircle } from "lucide-react";
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

interface FormState {
  title: string;
  slug: string;
  sku: string;
  brand: string;
  shortDescription: string;
  description: string;
  basePriceCents: string;
  compareAtPriceCents: string;
  initialStock: string;
  featured: boolean;
  isTestProduct: boolean;
  freeShipping: boolean;
  primaryCategoryId: string;
  categoryIds: string[];
  tagIds: string[];
}

const ENTITY_TYPE = "shop_product";

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export default function NewProductPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<FormState>({
    title: "",
    slug: "",
    sku: "",
    brand: "",
    shortDescription: "",
    description: "",
    basePriceCents: "",
    compareAtPriceCents: "",
    initialStock: "0",
    featured: false,
    isTestProduct: false,
    freeShipping: false,
    primaryCategoryId: "",
    categoryIds: [],
    tagIds: [],
  });

  function set<K extends keyof FormState>(patch: Pick<FormState, K>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  const [featuredImageKey, setFeaturedImageKey] = useState<string | null>(null);
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
  const [media, setMedia] = useState<ResolvedProductMediaItem[]>([]);
  const [infoSections, setInfoSections] = useState<ProductInfoSection[]>([]);
  const [trustBadges, setTrustBadges] = useState<ProductTrustBadge[]>([]);
  const [faqs, setFaqs] = useState<ProductFaq[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { translations, setTranslation, saveTranslations } = useEntityTranslations(ENTITY_TYPE, null);

  useEffect(() => {
    api.get<Category[]>("/next-api/admin/shop/categories").then(setCategories).catch(() => {});
    api.get<Tag[]>("/next-api/admin/shop/tags").then(setTags).catch(() => {});
  }, []);

  // ── Section AI-generate wiring ───────────────────────────────────────────
  const titleGen = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/products/sections/title/translate");
  const shortDescGen = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/products/sections/short-description/translate");
  const descGen = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/products/sections/description/translate");
  const [genErrors, setGenErrors] = useState<Record<string, string | null>>({});

  async function applyPlainGenerate(gen: ReturnType<typeof useSectionGenerate<SectionTranslationOutcome<string>>>, sourceText: string, field: string) {
    const outcome = await gen.generate({ text: sourceText });
    if (!outcome) return;
    for (const [lang, value] of Object.entries(outcome.result) as [string, string][]) {
      setTranslation(lang as never, field, value);
    }
    setGenErrors((prev) => ({ ...prev, [field]: summarizeGenerateErrors(outcome.errors) }));
  }

  function toggleCategory(cid: string) {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(cid) ? f.categoryIds.filter((x) => x !== cid) : [...f.categoryIds, cid],
    }));
  }
  function toggleTag(tid: string) {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tid) ? f.tagIds.filter((x) => x !== tid) : [...f.tagIds, tid],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const categoryIds = form.primaryCategoryId && !form.categoryIds.includes(form.primaryCategoryId) ? [form.primaryCategoryId, ...form.categoryIds] : form.categoryIds;

    try {
      const product = await api.post<{ id: string }>("/next-api/admin/shop/products", {
        title: form.title,
        slug: form.slug || undefined,
        sku: form.sku || null,
        brand: form.brand || null,
        shortDescription: form.shortDescription || null,
        description: form.description || null,
        featuredImageKey,
        media: media.map((m) => ({ key: m.key, type: m.type, posterKey: m.posterKey, altText: m.altText, isFeatured: m.isFeatured })),
        infoSections,
        trustBadges,
        faqs,
        basePriceCents: Math.round(Number(form.basePriceCents || 0) * 100),
        compareAtPriceCents: form.compareAtPriceCents.trim() === "" ? null : Math.round(Number(form.compareAtPriceCents) * 100),
        initialStock: parseInt(form.initialStock, 10) || 0,
        featured: form.featured,
        isTestProduct: form.isTestProduct,
        freeShipping: form.freeShipping,
        primaryCategoryId: form.primaryCategoryId || null,
        categoryIds: categoryIds.length ? categoryIds : undefined,
        tagIds: form.tagIds.length ? form.tagIds : undefined,
      });

      const fields = [
        "title",
        "shortDescription",
        "description",
        ...infoSections.flatMap((s) => [`infoSection:${s.id}:label`, `infoSection:${s.id}:value`]),
        ...trustBadges.flatMap((b) => [`trustBadge:${b.id}:title`, `trustBadge:${b.id}:subtitle`]),
        ...faqs.flatMap((f) => [`faq:${f.id}:question`, `faq:${f.id}:answer`]),
      ];
      await saveTranslations(product.id, fields);

      router.push(`/admin/shop/products/${product.id}`);
    } catch (err) {
      setError(errMessage(err, "Could not create product"));
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Sticky topbar ── */}
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <Link href="/admin/shop/products" className={styles.backBtn}>
            ← Products
          </Link>
          <span className={styles.topbarTitle}>{form.title || "New product"}</span>
        </div>
        <div className={styles.topbarActions}>
          {error && <span className={ui.error}>{error}</span>}
          <button type="submit" form="product-form" className={styles.saveBtn} disabled={submitting}>
            {submitting ? "Creating…" : "Create product"}
          </button>
        </div>
      </div>

      <form id="product-form" onSubmit={handleSubmit} className={styles.body}>
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
                baseValue={form.title}
                baseOnChange={(v) => set({ title: v })}
                baseRequired
                translations={translations}
                onTranslationChange={setTranslation}
                onGenerate={() => applyPlainGenerate(titleGen, form.title, "title")}
                generating={titleGen.generating}
                generateError={titleGen.error ?? genErrors.title ?? null}
              />
              <div className={styles.fieldRow} style={{ marginTop: 16 }}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Slug <span className={styles.hint} style={{ fontWeight: 400 }}>(auto-generated)</span>
                  </label>
                  <input className={styles.input} value={form.slug} onChange={(e) => set({ slug: e.target.value })} placeholder="auto-generated from title" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Brand</label>
                  <input className={styles.input} value={form.brand} onChange={(e) => set({ brand: e.target.value })} />
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <BilingualField
                  label="Short description"
                  field="shortDescription"
                  baseValue={form.shortDescription}
                  baseOnChange={(v) => set({ shortDescription: v })}
                  translations={translations}
                  onTranslationChange={setTranslation}
                  multiline
                  rows={2}
                  onGenerate={() => applyPlainGenerate(shortDescGen, form.shortDescription, "shortDescription")}
                  generating={shortDescGen.generating}
                  generateError={shortDescGen.error ?? genErrors.shortDescription ?? null}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <BilingualField
                  label="Description"
                  field="description"
                  baseValue={form.description}
                  baseOnChange={(v) => set({ description: v })}
                  translations={translations}
                  onTranslationChange={setTranslation}
                  richText
                  onGenerate={() => applyPlainGenerate(descGen, form.description, "description")}
                  generating={descGen.generating}
                  generateError={descGen.error ?? genErrors.description ?? null}
                />
              </div>
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionIcon}>
                <DollarSign size={15} />
              </span>
              <span className={styles.sectionTitle}>Pricing &amp; Stock</span>
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
                    value={form.basePriceCents}
                    onChange={(e) => set({ basePriceCents: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Compare-at price (€) <span className={styles.hint} style={{ fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input className={styles.input} type="number" step="0.01" min="0" value={form.compareAtPriceCents} onChange={(e) => set({ compareAtPriceCents: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div className={styles.fieldRow} style={{ marginTop: 16 }}>
                <div className={styles.field}>
                  <label className={styles.label}>Initial stock</label>
                  <input className={styles.input} type="number" min="0" value={form.initialStock} onChange={(e) => set({ initialStock: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    SKU <span className={styles.hint} style={{ fontWeight: 400 }}>(auto-generated)</span>
                  </label>
                  <input className={styles.input} value={form.sku} onChange={(e) => set({ sku: e.target.value })} placeholder="auto-generated" />
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
              <div className={styles.field} style={{ marginBottom: 16 }}>
                <label className={styles.label}>Featured image</label>
                <MediaPicker value={featuredImageKey} previewUrl={featuredImageUrl} onChange={(key, url) => { setFeaturedImageKey(key); setFeaturedImageUrl(url); }} label="featured image" />
              </div>
              <ProductMediaManager initialMedia={[]} onChange={(m) => setMedia(m as ResolvedProductMediaItem[])} />
            </div>
          </div>

          {/* Specifications */}
          <CollapsibleSection icon={<ClipboardList size={15} />} title="Specifications">
            <ProductInfoSectionsManager initialSections={[]} translations={translations} onTranslationChange={setTranslation} onChange={setInfoSections} />
          </CollapsibleSection>

          {/* Trust badges */}
          <CollapsibleSection icon={<Shield size={15} />} title="Trust badges">
            <ProductTrustBadgesManager initialBadges={[]} translations={translations} onTranslationChange={setTranslation} onChange={setTrustBadges} />
          </CollapsibleSection>

          {/* FAQs */}
          <CollapsibleSection icon={<HelpCircle size={15} />} title="FAQs" last>
            <ProductFaqsManager initialFaqs={[]} translations={translations} onTranslationChange={setTranslation} onChange={setFaqs} />
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
              <p className={styles.hint} style={{ margin: "0 0 12px" }}>
                New products start as <strong>Draft</strong> — publish once ready from the product page.
              </p>
              <div className={styles.divider} />
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Featured</div>
                  <div className={styles.toggleNote}>Show in featured sections</div>
                </div>
                <input type="checkbox" checked={form.featured} onChange={(e) => set({ featured: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--color-accent)", cursor: "pointer" }} />
              </div>
              <div className={styles.divider} />
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Test product</div>
                  <div className={styles.toggleNote}>Measures demand before you order stock. Customers can browse, add to cart and enter shipping, but checkout fails at the payment step.</div>
                </div>
                <input type="checkbox" checked={form.isTestProduct} onChange={(e) => set({ isTestProduct: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--color-accent)", cursor: "pointer" }} />
              </div>
              {form.isTestProduct && (
                <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px" }}>
                  This product cannot be sold. The payment form never loads and no charge is ever created.
                </p>
              )}
              <div className={styles.divider} />
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Free shipping</div>
                  <div className={styles.toggleNote}>Delivery is offered on this product. A &ldquo;Free shipping&rdquo; badge appears on the listing, product page and cart.</div>
                </div>
                <input type="checkbox" checked={form.freeShipping} onChange={(e) => set({ freeShipping: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--color-accent)", cursor: "pointer" }} />
              </div>
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
                  <select className={styles.select} value={form.primaryCategoryId} onChange={(e) => set({ primaryCategoryId: e.target.value })}>
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
                      <input type="checkbox" checked={form.categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} />
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
                          <input type="checkbox" checked={form.tagIds.includes(t.id)} onChange={() => toggleTag(t.id)} />
                          {t.name}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
