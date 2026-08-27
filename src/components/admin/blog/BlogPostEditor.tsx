"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { slugify } from "@/lib/slugify";
import BilingualField from "@/components/admin/BilingualField";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import Button from "@/components/admin/ui/Button";
import BlogProductPicker, { type BlogProductRef } from "./BlogProductPicker";
import { useEntityTranslations } from "@/hooks/useEntityTranslations";
import { useCopyGenerate } from "@/hooks/useCopyGenerate";
import { useToast } from "@/components/toast/ToastContext";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./BlogPostEditor.module.css";

const ENTITY_TYPE = "blog_post";
const TRANSLATION_FIELDS = ["title", "excerpt", "content", "seoTitle", "seoDescription", "featuredImageAlt"];

type Status = "draft" | "scheduled" | "published" | "archived";

interface Category { id: string; name: string; color: string | null; }
interface Tag { id: string; name: string; }

interface Post {
  id: string;
  status: Status;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featuredImageKey: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  scheduledPublishAt: string | null;
  featured: boolean;
  authorName: string | null;
  categories: Category[];
  tags: Tag[];
  productRefs?: ApiProductRef[];
}

/** Shape returned by the blog API — flattened into BlogProductRef for the picker. */
interface ApiProductRef {
  label: string | null;
  product: { id: string; title: string; status: string; featuredImageUrl: string | null };
}

interface Props { postId?: string; }

export default function BlogPostEditor({ postId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!postId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [featuredImageAlt, setFeaturedImageAlt] = useState("");

  const [status, setStatus] = useState<Status>("draft");
  const [featuredImageKey, setFeaturedImageKey] = useState<string | null>(null);
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [featured, setFeatured] = useState(false);
  const [authorName, setAuthorName] = useState("");

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [productRefs, setProductRefs] = useState<BlogProductRef[]>([]);

  const [entityId, setEntityId] = useState<string | null>(postId ?? null);
  const { translations, setTranslation, saveTranslations } = useEntityTranslations(ENTITY_TYPE, entityId);
  const gen = useCopyGenerate(setTranslation);

  useEffect(() => {
    Promise.all([
      api.get<Category[]>("/next-api/admin/blog/categories"),
      api.get<Tag[]>("/next-api/admin/blog/tags"),
    ]).then(([cats, tags]) => { setAllCategories(cats); setAllTags(tags); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit || !postId) {
      const t = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(t);
    }
    api.get<Post>(`/next-api/admin/blog/posts/${postId}`)
      .then((p) => {
        setStatus(p.status);
        setTitle(p.title);
        setSlug(p.slug);
        setExcerpt(p.excerpt ?? "");
        setContent(p.content ?? "");
        setSeoTitle(p.seoTitle ?? "");
        setSeoDescription(p.seoDescription ?? "");
        setCanonicalUrl(p.canonicalUrl ?? "");
        setFeaturedImageAlt(p.featuredImageAlt ?? "");
        setFeaturedImageKey(p.featuredImageKey);
        setFeaturedImageUrl(p.featuredImageUrl);
        setScheduledPublishAt(p.scheduledPublishAt ? p.scheduledPublishAt.slice(0, 16) : "");
        setFeatured(p.featured);
        setAuthorName(p.authorName ?? "");
        setCategoryIds(p.categories.map((c) => c.id));
        setTagIds(p.tags.map((t) => t.id));
        setProductRefs(
          (p.productRefs ?? []).map((r) => ({
            productId: r.product.id,
            label: r.label ?? "",
            title: r.product.title,
            imageUrl: r.product.featuredImageUrl,
            status: r.product.status,
          })),
        );
      })
      .catch(() => toast.error("Failed to load article"))
      .finally(() => setLoading(false));
  }, [postId, isEdit, toast]);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!isEdit || status === "draft") setSlug(slugify(val));
  }

  const buildPayload = useCallback(() => ({
    title,
    slug: slug || undefined,
    excerpt: excerpt || null,
    content: content || null,
    seoTitle: seoTitle || null,
    seoDescription: seoDescription || null,
    canonicalUrl: canonicalUrl || null,
    featuredImageAlt: featuredImageAlt || null,
    featuredImageKey: featuredImageKey || null,
    status,
    scheduledPublishAt: scheduledPublishAt ? new Date(scheduledPublishAt).toISOString() : null,
    featured,
    authorName: authorName || null,
    categoryIds,
    tagIds,
    // Array order is authoritative — the backend assigns sortOrder from it.
    productRefs: productRefs.map((r) => ({ productId: r.productId, label: r.label.trim() || null })),
  }), [title, slug, excerpt, content, seoTitle, seoDescription, canonicalUrl, featuredImageAlt, featuredImageKey, status, scheduledPublishAt, featured, authorName, categoryIds, tagIds, productRefs]);

  async function save(opts: { publish?: boolean } = {}) {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      let id = entityId;
      if (isEdit && id) {
        await api.patch(`/next-api/admin/blog/posts/${id}`, payload);
      } else {
        const created = await api.post<Post>("/next-api/admin/blog/posts", payload);
        id = created.id;
        setEntityId(id);
      }
      await saveTranslations(id!, TRANSLATION_FIELDS);
      if (opts.publish) {
        await api.post(`/next-api/admin/blog/posts/${id}/publish`);
        setStatus("published");
      }
      toast.success("Article saved");
      if (!isEdit) router.replace(`/admin/blog/${id}/edit`);
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const selectedCategories = allCategories.filter((c) => categoryIds.includes(c.id));
  const selectedTags = allTags.filter((t) => tagIds.includes(t.id));
  const availableCategories = allCategories.filter((c) => !categoryIds.includes(c.id));
  const availableTags = allTags.filter((t) => !tagIds.includes(t.id));

  if (loading) return <div className={ui.emptyState}>Loading…</div>;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <Link href="/admin/blog" style={{ fontSize: "0.85rem", color: "var(--color-secondary)" }}>← Articles</Link>
          <h1 className={ui.pageTitle}>{isEdit ? "Edit article" : "New article"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={() => save()} disabled={saving}>
            {saving ? "Saving…" : "Save draft"}
          </Button>
          {status !== "published" && (
            <Button
              onClick={() => { setPublishing(true); save({ publish: true }).finally(() => setPublishing(false)); }}
              disabled={saving || publishing}
            >
              {publishing ? "Publishing…" : "Publish"}
            </Button>
          )}
        </div>
      </div>

      <div className={styles.layout}>
        {/* ── Main column ── */}
        <div className={styles.main}>
          <div className={ui.card} style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <BilingualField
              label="Title"
              field="title"
              baseValue={title}
              baseOnChange={handleTitleChange}
              baseRequired
              basePlaceholder="Article title"
              translations={translations}
              onTranslationChange={setTranslation}
              {...gen.field("title", title)}
            />
            <div className={ui.field}>
              <label className={ui.label}>Slug</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input className={ui.input} style={{ flex: 1 }} value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="article-url-slug" />
                <Button type="button" variant="secondary" onClick={() => setSlug(slugify(title))}>↺ Regenerate</Button>
              </div>
            </div>
            <BilingualField
              label="Excerpt"
              field="excerpt"
              baseValue={excerpt}
              baseOnChange={setExcerpt}
              basePlaceholder="A short, compelling summary shown in cards & meta"
              translations={translations}
              onTranslationChange={setTranslation}
              multiline
              rows={3}
              {...gen.field("excerpt", excerpt)}
            />
          </div>

          <div className={ui.card} style={{ padding: "1rem" }}>
            <BilingualField
              label="Content"
              field="content"
              baseValue={content}
              baseOnChange={setContent}
              basePlaceholder="Start writing your article…"
              translations={translations}
              onTranslationChange={setTranslation}
              richText
              {...gen.field("content", content, "html")}
            />
          </div>

          <div className={ui.card} style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>Featured products</div>
            <BlogProductPicker value={productRefs} onChange={setProductRefs} />
          </div>

          <div className={ui.card} style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>SEO</div>
            <BilingualField
              label="SEO title"
              field="seoTitle"
              baseValue={seoTitle}
              baseOnChange={setSeoTitle}
              basePlaceholder="Defaults to article title"
              translations={translations}
              onTranslationChange={setTranslation}
              maxLength={70}
              {...gen.field("seoTitle", seoTitle)}
            />
            <BilingualField
              label="SEO description"
              field="seoDescription"
              baseValue={seoDescription}
              baseOnChange={setSeoDescription}
              basePlaceholder="Meta description for search engines"
              translations={translations}
              onTranslationChange={setTranslation}
              multiline
              rows={3}
              maxLength={160}
              {...gen.field("seoDescription", seoDescription)}
            />
            <div className={ui.field}>
              <label className={ui.label}>Canonical URL (optional)</label>
              <input className={ui.input} type="url" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} placeholder="https://example.com/blog/original-post" />
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className={styles.sidebar}>
          <div className={ui.card} style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>Status</div>
            <select className={ui.select} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            {status === "scheduled" && (
              <div className={ui.field}>
                <label className={ui.label}>Publish at</label>
                <input type="datetime-local" className={ui.input} value={scheduledPublishAt} onChange={(e) => setScheduledPublishAt(e.target.value)} />
              </div>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              Featured article
            </label>
          </div>

          <div className={ui.card} style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>Author</div>
            <input className={ui.input} value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Author name" />
          </div>

          <div className={ui.card} style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>Featured image</div>
            <MediaPicker
              value={featuredImageKey}
              previewUrl={featuredImageUrl}
              mediaType="image"
              label="featured image"
              onChange={(key, url) => { setFeaturedImageKey(key); setFeaturedImageUrl(url); }}
            />
            {featuredImageKey && (
              <BilingualField
                label="Alt text"
                field="featuredImageAlt"
                baseValue={featuredImageAlt}
                baseOnChange={setFeaturedImageAlt}
                basePlaceholder="Image description for screen readers"
                translations={translations}
                onTranslationChange={setTranslation}
                {...gen.field("featuredImageAlt", featuredImageAlt)}
              />
            )}
          </div>

          <div className={ui.card} style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>Categories</div>
            <div className={ui.chipList}>
              {selectedCategories.map((c) => (
                <span key={c.id} className={ui.chip}>
                  {c.name}
                  <button type="button" className={ui.chipRemove} onClick={() => setCategoryIds((ids) => ids.filter((id) => id !== c.id))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            {availableCategories.length > 0 && (
              <select
                className={ui.select}
                value=""
                onChange={(e) => { if (e.target.value) setCategoryIds((ids) => [...ids, e.target.value]); }}
              >
                <option value="">+ Add category…</option>
                {availableCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>

          <div className={ui.card} style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>Tags</div>
            <div className={ui.chipList}>
              {selectedTags.map((t) => (
                <span key={t.id} className={ui.chip}>
                  {t.name}
                  <button type="button" className={ui.chipRemove} onClick={() => setTagIds((ids) => ids.filter((id) => id !== t.id))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            {availableTags.length > 0 && (
              <select
                className={ui.select}
                value=""
                onChange={(e) => { if (e.target.value) setTagIds((ids) => [...ids, e.target.value]); }}
              >
                <option value="">+ Add tag…</option>
                {availableTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          <Button onClick={() => save()} disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
