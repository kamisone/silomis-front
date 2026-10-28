"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, FileText, ImageOff, Mail, Package, Search, Sparkles, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import Switch from "@/components/admin/ui/Switch";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import ProductPicker from "@/components/admin/shop/ProductPicker";
import ProductFaqsManager from "@/components/admin/shop/ProductFaqsManager";
import BilingualField from "@/components/admin/BilingualField";
import { useEntityTranslations } from "@/hooks/useEntityTranslations";
import { useCopyGenerate } from "@/hooks/useCopyGenerate";
import type { ProductFaq } from "@/lib/shop/productContent.types";
import ui from "@/components/admin/ui/admin-ui.module.css";
import edit from "../../collections/[id]/CollectionEdit.module.css";
import styles from "../Brands.module.css";
import { useToast } from "@/components/toast/ToastContext";

/** Same string as the backend's ET_STORE_BRAND. */
const ENTITY_TYPE = "shop_store_brand";
const FORM_ID = "brand-form";
const TRANSLATED = ["tagline", "footerText", "aboutTitle", "aboutHtml", "contactIntro", "returnsNote", "seoTitle", "seoDescription"];

interface BrandProduct {
  id: string;
  title: string;
  slug: string;
  status: string;
  featuredImageUrl: string | null;
}

interface StoreBrand {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoKey: string | null;
  logoUrl: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  footerText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  aboutTitle: string | null;
  aboutHtml: string | null;
  contactIntro: string | null;
  returnsNote: string | null;
  faqs: ProductFaq[];
  seoTitle: string | null;
  seoDescription: string | null;
  shareImageKey: string | null;
  shareImageUrl: string | null;
  isActive: boolean;
  products: BrandProduct[];
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

function SectionDivider({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className={edit.formDivider}>
      <span className={edit.sectionIcon}>{icon}</span>
      <div className={edit.sectionHeading}>
        <h2 className={edit.sectionTitle}>{title}</h2>
        <span className={edit.sectionDesc}>{desc}</span>
      </div>
    </div>
  );
}

export default function StoreBrandPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [brand, setBrand] = useState<StoreBrand | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Remounts the FAQ editor after a save, which owns its own copy of the list. */
  const [faqVersion, setFaqVersion] = useState(0);

  const { translations, setTranslation, saveTranslations } = useEntityTranslations(ENTITY_TYPE, brand?.id ?? null);
  const gen = useCopyGenerate(setTranslation);

  useEffect(() => {
    api.get<StoreBrand>(`/next-api/admin/shop/store-brands/${params.id}`).then(setBrand);
  }, [params.id]);

  function set(patch: Partial<StoreBrand>) {
    setBrand((b) => (b ? { ...b, ...patch } : b));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!brand) return;
    setSaving(true);
    try {
      const updated = await api.patch<StoreBrand>(`/next-api/admin/shop/store-brands/${brand.id}`, {
        name: brand.name,
        slug: brand.slug,
        tagline: brand.tagline,
        logoKey: brand.logoKey,
        iconKey: brand.iconKey,
        footerText: brand.footerText,
        supportEmail: brand.supportEmail,
        supportPhone: brand.supportPhone,
        aboutTitle: brand.aboutTitle,
        aboutHtml: brand.aboutHtml,
        contactIntro: brand.contactIntro,
        returnsNote: brand.returnsNote,
        faqs: brand.faqs,
        seoTitle: brand.seoTitle,
        seoDescription: brand.seoDescription,
        shareImageKey: brand.shareImageKey,
        isActive: brand.isActive,
      });
      await saveTranslations(brand.id, [...TRANSLATED, ...brand.faqs.flatMap((f) => [`faq:${f.id}:question`, `faq:${f.id}:answer`])]);
      setBrand(updated);
      setFaqVersion((v) => v + 1);
      toast.success("Changes saved");
    } catch (err) {
      toast.error(errorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function linkProduct(productId: string) {
    if (!brand || !productId) return;
    try {
      const updated = await api.post<StoreBrand>(`/next-api/admin/shop/store-brands/${brand.id}/products`, { productId });
      set({ products: updated.products });
    } catch (err) {
      toast.error(errorMessage(err, "Could not add the product"));
    }
  }

  async function unlinkProduct(productId: string) {
    if (!brand) return;
    try {
      const updated = await api.delete<StoreBrand>(`/next-api/admin/shop/store-brands/${brand.id}/products/${productId}`);
      set({ products: updated.products });
    } catch (err) {
      toast.error(errorMessage(err, "Could not remove the product"));
    }
  }

  async function handleDelete() {
    if (!brand) return;
    setConfirmDelete(false);
    try {
      await api.delete(`/next-api/admin/shop/store-brands/${brand.id}`);
      toast.success("Brand deleted");
      router.push("/admin/shop/brands");
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete the brand"));
    }
  }

  if (!brand) {
    return (
      <div className={ui.page}>
        <div className={ui.emptyState}>Loading…</div>
      </div>
    );
  }

  const field = (key: keyof StoreBrand) => ({
    field: key,
    baseValue: (brand[key] as string | null) ?? "",
    baseOnChange: (v: string) => set({ [key]: v || null } as Partial<StoreBrand>),
    translations,
    onTranslationChange: setTranslation,
    ...gen.field(key, (brand[key] as string | null) ?? "", key === "aboutHtml" ? "html" : undefined),
  });

  return (
    <div className={ui.page}>
      <div className={`${ui.pageHeader} ${edit.stickyHeader}`}>
        <div className={edit.headerTitle}>
          <Link href="/admin/shop/brands" className={edit.backLink}>
            ← Neutral brands
          </Link>
          <h1 className={ui.pageTitle}>{brand.name}</h1>
        </div>
        <div className={edit.headerActions}>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className={ui.card}>
        <form id={FORM_ID} onSubmit={handleSubmit} className={edit.form}>
          <div className={ui.formGrid}>
            <div className={ui.field}>
              <label className={ui.label}>Brand name</label>
              <input className={ui.input} value={brand.name} onChange={(e) => set({ name: e.target.value })} required />
              <span className={styles.hint}>Same in every language. Shown in the header when there is no logo, in emails, texts, the legal pages and on the bank statement.</span>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Slug</label>
              <input className={ui.input} value={brand.slug} onChange={(e) => set({ slug: e.target.value })} required />
              <span className={styles.hint}>/brand/{brand.slug}/about</span>
            </div>
          </div>

          <Switch
            label="Active"
            hint="Off: its products go back to the simple Silomis layout and nothing is sent under the brand. Turn it on once the brand is ready."
            checked={brand.isActive}
            onChange={(isActive) => set({ isActive })}
          />

          <div className={ui.field}>
            <label className={ui.label}>Logo &amp; icon</label>
            <div className={edit.imageSlots}>
              <div className={edit.imageSlot}>
                <span className={edit.imageSlotLabel}>Icon</span>
                <span className={edit.imageSlotHint}>Square. Browser tab and email header — use a PNG, emails do not show WebP or SVG.</span>
                <MediaPicker value={brand.iconKey} previewUrl={brand.iconUrl} onChange={(key, url) => set({ iconKey: key, iconUrl: url })} label="Icon" mediaType="image" asAddTile />
              </div>
              <div className={edit.imageSlot}>
                <span className={edit.imageSlotLabel}>Logo</span>
                <span className={edit.imageSlotHint}>Header and footer, any shape — about 40px high on screen. Without one, the name is shown.</span>
                <MediaPicker value={brand.logoKey} previewUrl={brand.logoUrl} onChange={(key, url) => set({ logoKey: key, logoUrl: url })} label="Logo" mediaType="image" asAddTile className={`${edit.bannerTile} ${styles.logoTile}`} />
              </div>
            </div>
          </div>

          <BilingualField label="Tagline" {...field("tagline")} basePlaceholder="Coffee, anywhere" maxLength={200} />

          <SectionDivider icon={<Mail size={15} strokeWidth={2} />} title="Footer & contact" desc="Under the logo in the footer, and where customers reach the brand." />

          <BilingualField label="Footer text" {...field("footerText")} multiline basePlaceholder="One or two sentences about the brand." />
          <div className={ui.formGrid}>
            <div className={ui.field}>
              <label className={ui.label}>Support email</label>
              <input className={ui.input} type="email" value={brand.supportEmail ?? ""} onChange={(e) => set({ supportEmail: e.target.value || null })} placeholder="hello@brewmini.com" />
              <span className={styles.hint}>Footer, contact page, and Reply-To of its emails. Empty: the shop&apos;s own.</span>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Support phone</label>
              <input className={ui.input} value={brand.supportPhone ?? ""} onChange={(e) => set({ supportPhone: e.target.value || null })} placeholder="Optional" />
            </div>
          </div>

          <SectionDivider icon={<FileText size={15} strokeWidth={2} />} title="Pages" desc="The brand's own pages, linked from its footer. Leave one empty and its link is not shown." />

          <BilingualField label="About — title" {...field("aboutTitle")} basePlaceholder={`About ${brand.name}`} />
          <BilingualField label="About — page" {...field("aboutHtml")} richText />
          <BilingualField label="Contact — intro" {...field("contactIntro")} multiline basePlaceholder="A question about your coffee maker or your order? Write to us." />
          <BilingualField label="Returns — product conditions" {...field("returnsNote")} multiline rows={3} basePlaceholder="E.g. a used machine must be descaled and dry before it is sent back." />
          <span className={styles.hint}>Shown at the top of the brand&apos;s returns page. The 14-day right of withdrawal and legal guarantees below it are the shop&apos;s and cannot be changed here.</span>

          <div className={ui.field}>
            <label className={ui.label}>FAQ</label>
            <ProductFaqsManager key={faqVersion} initialFaqs={brand.faqs} translations={translations} onTranslationChange={setTranslation} onChange={(faqs) => set({ faqs })} />
          </div>

          <SectionDivider icon={<Sparkles size={15} strokeWidth={2} />} title="Search & sharing" desc="Replaces “Silomis” in the browser tab and in search results on the brand's pages." />

          <BilingualField label="SEO title" {...field("seoTitle")} basePlaceholder={brand.name} />
          <BilingualField label="SEO description" {...field("seoDescription")} multiline />
          <div className={ui.field}>
            <label className={ui.label}>Share image</label>
            <span className={styles.hint}>When a brand page is shared (1200×630). Product pages use their own photo.</span>
            <div className={styles.shareTile}>
              <MediaPicker value={brand.shareImageKey} previewUrl={brand.shareImageUrl} onChange={(key, url) => set({ shareImageKey: key, shareImageUrl: url })} label="Share image" mediaType="image" asAddTile className={edit.bannerTile} />
            </div>
          </div>
        </form>
      </div>

      <section className={edit.productsCard}>
        <header className={edit.sectionHeader}>
          <span className={edit.sectionIcon}>
            <Package size={16} strokeWidth={2} />
          </span>
          <div className={edit.sectionHeading}>
            <h2 className={edit.sectionTitle}>Products</h2>
            <span className={edit.sectionDesc}>
              {brand.products.length === 0
                ? "No product is sold under this brand yet."
                : `${brand.products.length} product${brand.products.length === 1 ? "" : "s"} sold under ${brand.name}. A product belongs to one brand: adding it here moves it from any other.`}
            </span>
          </div>
        </header>

        <div className={edit.addRow}>
          <ProductPicker value="" onChange={linkProduct} label="Add a product" placeholder="Search the catalogue…" excludeIds={brand.products.map((p) => p.id)} withThumbnails className={edit.addPicker} />
        </div>

        {brand.products.length === 0 ? (
          <div className={edit.emptyProducts}>
            <Search size={20} strokeWidth={1.75} aria-hidden="true" />
            <p>Search above to add the first product.</p>
          </div>
        ) : (
          <ol className={edit.productList}>
            {brand.products.map((p) => (
              <li key={p.id} className={edit.productRow}>
                {p.featuredImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.featuredImageUrl} alt="" className={edit.rowThumb} loading="lazy" />
                ) : (
                  <span className={`${edit.rowThumb} ${edit.rowThumbEmpty}`} aria-hidden="true">
                    <ImageOff size={14} strokeWidth={2} />
                  </span>
                )}
                <Link href={`/admin/shop/products/${p.id}`} className={edit.rowTitle}>
                  {p.title}
                </Link>
                <div className={edit.rowActions}>
                  {p.status === "active" && (
                    <a href={`/en/shop/${p.slug}`} target="_blank" rel="noreferrer" className={edit.iconBtn} aria-label={`View ${p.title} on the shop`}>
                      <ExternalLink size={14} strokeWidth={2.2} />
                    </a>
                  )}
                  <button type="button" className={`${edit.iconBtn} ${edit.iconBtnDanger}`} onClick={() => unlinkProduct(p.id)} aria-label={`Remove ${p.title} from ${brand.name}`}>
                    <Trash2 size={14} strokeWidth={2.2} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {confirmDelete && (
        <Modal
          title="Delete brand"
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
            Delete <strong>{brand.name}</strong>? Its products go back to being sold as Silomis, and past orders lose the brand on their tracking page. To
            pause it instead, switch it off. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
