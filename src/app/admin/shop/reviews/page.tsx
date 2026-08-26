"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Store, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import StarRatingInput from "@/components/admin/ui/StarRatingInput";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./Reviews.module.css";
import { useToast } from "@/components/toast/ToastContext";

type ReviewStatus = "pending" | "approved" | "rejected" | "hidden";

interface ReviewMedia {
  key: string;
  type: "image" | "video";
  url: string;
}

interface Review {
  id: string;
  productId: string;
  authorName: string;
  /** Null for imported reviews — there is no customer behind them. */
  authorEmail: string | null;
  source?: "customer" | "imported";
  sourceUrl?: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  media: ReviewMedia[];
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  rejectionReason: string | null;
  createdAt: string;
  product: { id: string; title: string };
}

const TABS: Array<{ key: ReviewStatus | ""; label: string }> = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "hidden", label: "Hidden" },
];

const COUNTED_STATUSES: ReviewStatus[] = ["pending", "approved", "rejected", "hidden"];

/** Matches the API's cap on a review's media array. */
const MAX_MEDIA = 8;

function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

interface ProductOption {
  id: string;
  title: string;
  sku?: string | null;
  featuredImageUrl?: string | null;
}

interface ReviewFormMedia {
  key: string;
  type: "image" | "video";
  url: string | null;
}

interface ReviewForm {
  productId: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  /** yyyy-mm-dd, as <input type="date"> gives it. */
  date: string;
  sourceUrl: string;
  media: ReviewFormMedia[];
}

/**
 * Which modal is open, and over what.
 *
 * Both modes render the same fields from the same state — the edit dialog
 * having drifted to a third of the create dialog's is exactly what one shared
 * form prevents from happening again.
 */
type FormMode = { kind: "create" } | { kind: "edit"; review: Review };

/** Today in the local calendar, formatted for <input type="date">. Built from
 *  the parts rather than toISOString(), which would shift the day for anyone
 *  east or west of UTC around midnight. */
function todayInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyReviewForm(): ReviewForm {
  return { productId: "", authorName: "", rating: 5, title: "", body: "", date: todayInputValue(), sourceUrl: "", media: [] };
}

/** An existing review, in the shape the form edits. */
function formFromReview(r: Review): ReviewForm {
  const d = new Date(r.createdAt);
  return {
    productId: r.productId,
    authorName: r.authorName,
    rating: r.rating,
    title: r.title ?? "",
    body: r.body ?? "",
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    sourceUrl: r.sourceUrl ?? "",
    media: r.media.map((m) => ({ key: m.key, type: m.type, url: m.url })),
  };
}

export default function ReviewsAdminPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<ReviewStatus | "">("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Partial<Record<ReviewStatus, number>>>({});
  const [loading, setLoading] = useState(true);

  const [rejecting, setRejecting] = useState<Review | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);

  // ── The add / edit form ──
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [form, setForm] = useState<ReviewForm>(emptyReviewForm);
  const [formSaving, setFormSaving] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productQuery, setProductQuery] = useState("");

  const isEdit = formMode?.kind === "edit";
  const selectedProduct = products.find((p) => p.id === form.productId) ?? null;
  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 6);
    return products
      .filter((p) => p.title.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [products, productQuery]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (tab) params.set("status", tab);
      const res = await api.get<{ items: Review[]; total: number }>(`/next-api/admin/shop/reviews?${params.toString()}`);
      setReviews(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  async function loadCounts() {
    const results = await Promise.all(
      COUNTED_STATUSES.map((s) =>
        api
          .get<{ total: number }>(`/next-api/admin/shop/reviews?limit=1&status=${s}`)
          .catch(() => ({ total: 0 })),
      ),
    );
    const next: Partial<Record<ReviewStatus, number>> = {};
    COUNTED_STATUSES.forEach((s, i) => {
      next[s] = results[i].total;
    });
    setCounts(next);
  }

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Counts are per-status totals, unaffected by which tab is showing — fetching
  // them again on every tab change would be four requests for the same answer.
  useEffect(() => {
    const t = setTimeout(loadCounts, 0);
    return () => clearTimeout(t);
  }, []);

  /** Loaded once the form is first opened rather than with the page — the
   *  catalogue is only needed by this one modal. */
  async function loadProducts() {
    if (products.length > 0) return;
    const data = await api
      .get<{ items: ProductOption[] }>("/next-api/admin/shop/products?limit=200")
      .catch(() => null);
    setProducts(data?.items ?? []);
  }

  function openCreate() {
    setForm(emptyReviewForm());
    setProductQuery("");
    setFormMode({ kind: "create" });
    loadProducts();
  }

  function openEdit(review: Review) {
    setForm(formFromReview(review));
    setFormMode({ kind: "edit", review });
    loadProducts();
  }

  /** Photos land through `multi`, so a batch arrives at once. Keys already on
   *  the review are skipped rather than duplicated. */
  function addMedia(assets: Array<{ storageKey: string; url: string; mediaType: "image" | "video" | "other" }>) {
    setForm((f) => {
      const have = new Set(f.media.map((m) => m.key));
      const added = assets
        .filter((a) => !have.has(a.storageKey) && a.mediaType !== "other")
        .map((a) => ({ key: a.storageKey, type: a.mediaType as "image" | "video", url: a.url }));
      return { ...f, media: [...f.media, ...added].slice(0, MAX_MEDIA) };
    });
  }

  async function submitForm() {
    if (!formMode) return;
    if (!form.productId || !form.authorName.trim()) return;
    setFormSaving(true);
    // Midday rather than midnight: the date is displayed in the visitor's own
    // zone, and a midnight timestamp reads as the previous day west of the shop.
    const payload = {
      authorName: form.authorName.trim(),
      rating: form.rating,
      title: form.title.trim() || null,
      body: form.body.trim() || null,
      createdAt: new Date(`${form.date}T12:00:00`).toISOString(),
      sourceUrl: form.sourceUrl.trim() || null,
      media: form.media.map((m) => ({ key: m.key, type: m.type })),
    };
    try {
      if (formMode.kind === "edit") {
        await api.patch(`/next-api/admin/shop/reviews/${formMode.review.id}`, payload);
        toast.success("Review updated");
      } else {
        await api.post("/next-api/admin/shop/reviews", { ...payload, productId: form.productId });
        toast.success("Review added");
      }
      setFormMode(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? String((err.body as { message?: string })?.message ?? "Failed to save review")
          : "Failed to save review",
      );
    } finally {
      setFormSaving(false);
    }
  }

  async function moderate(id: string, status: ReviewStatus, rejectionReason?: string) {
    try {
      await api.patch(`/next-api/admin/shop/reviews/${id}/moderate`, { status, rejectionReason });
      toast.success(`Review ${status}`);
      await Promise.all([load(), loadCounts()]);
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to moderate review") : "Failed to moderate review");
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejecting) return;
    await moderate(rejecting.id, "rejected", rejectReason || undefined);
    setRejecting(null);
    setRejectReason("");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/next-api/admin/shop/reviews/${deleteTarget.id}`);
      toast.success("Review deleted");
      await Promise.all([load(), loadCounts()]);
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to delete review") : "Failed to delete review");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.pageTitle}>Reviews</h1>
          <span style={{ fontSize: "0.85rem", color: "var(--color-secondary)" }}>
            {total} {tab || "total"} reviews
          </span>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} strokeWidth={2.5} />
          Add a review
        </Button>
      </div>

      <div className={ui.toolbar}>
        {TABS.map((t) => {
          const count = t.key ? counts[t.key] : undefined;
          return (
            <Button key={t.key} variant={tab === t.key ? "primary" : "secondary"} onClick={() => setTab(t.key)}>
              {t.label}
              {!!count && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: "0.7rem",
                    padding: "0 6px",
                    borderRadius: 999,
                    background: tab === t.key ? "rgba(255,255,255,0.25)" : "var(--color-border)",
                  }}
                >
                  {count}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : reviews.length === 0 ? (
          <div className={ui.emptyState}>No reviews in this view.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Author</th>
                <th>Rating</th>
                <th>Review</th>
                <th>Status</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/shop/products/${r.productId}`} style={{ color: "var(--color-primary)" }}>
                      {r.product.title}
                    </Link>
                  </td>
                  <td>
                    {r.authorName}
                    <br />
                    {/* An imported review has no email to show; saying where it
                        came from instead is the more useful line. */}
                    {r.source === "imported" ? (
                      <span className={styles.sourceBadge} title={r.sourceUrl ?? "Entered in admin from a supplier listing"}>
                        <Store size={10} strokeWidth={2.5} />
                        sourced
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>{r.authorEmail}</span>
                    )}
                    {r.isVerifiedPurchase && (
                      <>
                        <br />
                        <span className={ui.badgeActive}>verified</span>
                      </>
                    )}
                  </td>
                  <td>{stars(r.rating)}</td>
                  <td style={{ maxWidth: 280 }}>
                    {r.title && <strong>{r.title}</strong>}
                    {r.body && <p style={{ margin: "4px 0", fontSize: "0.85rem" }}>{r.body}</p>}
                    {r.media.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0" }}>
                        {r.media.map((m) => (
                          <a
                            key={m.key}
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "block",
                              width: 44,
                              height: 44,
                              borderRadius: 6,
                              overflow: "hidden",
                              border: "1px solid var(--color-border)",
                              flexShrink: 0,
                            }}
                            title={m.type === "video" ? "View video attachment" : "View photo attachment"}
                          >
                            {m.type === "video" ? (
                              <video src={m.url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.url} alt="Review attachment" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                    {r.status === "rejected" && r.rejectionReason && <p style={{ fontSize: "0.75rem", color: "#dc2626" }}>Reason: {r.rejectionReason}</p>}
                  </td>
                  <td>
                    <span className={ui.badge}>{r.status}</span>
                  </td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className={ui.rowActions}>
                      {r.status !== "approved" && (
                        <Button variant="secondary" onClick={() => moderate(r.id, "approved")}>
                          Approve
                        </Button>
                      )}
                      {r.status !== "rejected" && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setRejecting(r);
                            setRejectReason("");
                          }}
                        >
                          Reject
                        </Button>
                      )}
                      {r.status === "approved" && (
                        <Button variant="secondary" onClick={() => moderate(r.id, "hidden")}>
                          Hide
                        </Button>
                      )}
                      <Button variant="secondary" onClick={() => openEdit(r)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => setDeleteTarget(r)}>
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

      {rejecting && (
        <Modal
          title="Reject review"
          onClose={() => setRejecting(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button type="submit" form="reject-review-form">
                Reject
              </Button>
            </>
          }
        >
          <form id="reject-review-form" onSubmit={handleReject} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={ui.field}>
              <label className={ui.label}>Reason (internal only, optional)</label>
              <textarea className={ui.textarea} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete this review?"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={confirmDelete}>
                Delete
              </Button>
            </>
          }
        >
          <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)", margin: 0 }}>
            This permanently removes the review by {deleteTarget.authorName} and its media. This can&apos;t be undone.
          </p>
        </Modal>
      )}

      {formMode && (
        <Modal
          title={isEdit ? "Edit review" : "Add a review"}
          onClose={() => setFormMode(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setFormMode(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submitForm}
                disabled={formSaving || !form.productId || !form.authorName.trim()}
              >
                {formSaving ? "Saving…" : isEdit ? "Save changes" : "Add review"}
              </Button>
            </>
          }
        >
          <div className={styles.form}>
            {!isEdit && (
              <p className={styles.formIntro}>
                For a review copied from a supplier or marketplace listing for this same product. It publishes
                immediately and counts toward the product&rsquo;s rating, and is never marked as a verified purchase.
              </p>
            )}

            <div className={styles.field}>
              <span className={styles.label}>Product</span>
              {/* Fixed once the review exists: moving one between products would
                  silently rewrite both products' ratings. */}
              {isEdit ? (
                <div className={`${styles.picked} ${styles.pickedLocked}`}>
                  {selectedProduct?.featuredImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedProduct.featuredImageUrl} alt="" className={styles.pickedThumb} />
                  ) : (
                    <span className={`${styles.pickedThumb} ${styles.pickedThumbBlank}`} aria-hidden="true">
                      <Store size={14} strokeWidth={2} />
                    </span>
                  )}
                  <span className={styles.pickedText}>
                    <span className={styles.pickedTitle}>
                      {selectedProduct?.title ?? formMode.review.product.title}
                    </span>
                    <span className={styles.pickedSub}>Can&rsquo;t be changed after the review exists</span>
                  </span>
                </div>
              ) : selectedProduct ? (
                <div className={styles.picked}>
                  {selectedProduct.featuredImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedProduct.featuredImageUrl} alt="" className={styles.pickedThumb} />
                  ) : (
                    <span className={`${styles.pickedThumb} ${styles.pickedThumbBlank}`} aria-hidden="true">
                      <Store size={14} strokeWidth={2} />
                    </span>
                  )}
                  <span className={styles.pickedText}>
                    <span className={styles.pickedTitle}>{selectedProduct.title}</span>
                    {selectedProduct.sku && <span className={styles.pickedSub}>{selectedProduct.sku}</span>}
                  </span>
                  <button
                    type="button"
                    className={styles.pickedClear}
                    onClick={() => setForm({ ...form, productId: "" })}
                    aria-label="Choose a different product"
                  >
                    <X size={14} strokeWidth={2.4} />
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.searchRow}>
                    <Search size={14} strokeWidth={2} className={styles.searchIcon} />
                    <input
                      className={styles.searchInput}
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      placeholder="Search products by name or SKU…"
                      autoFocus
                    />
                  </div>
                  {productMatches.length === 0 ? (
                    <p className={styles.searchEmpty}>
                      {products.length === 0 ? "Loading products…" : "Nothing matches that."}
                    </p>
                  ) : (
                    <ul className={styles.results}>
                      {productMatches.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className={styles.result}
                            onClick={() => setForm({ ...form, productId: p.id })}
                          >
                            {p.featuredImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.featuredImageUrl} alt="" className={styles.resultThumb} />
                            ) : (
                              <span className={`${styles.resultThumb} ${styles.pickedThumbBlank}`} aria-hidden="true" />
                            )}
                            <span className={styles.pickedText}>
                              <span className={styles.pickedTitle}>{p.title}</span>
                              {p.sku && <span className={styles.pickedSub}>{p.sku}</span>}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <span className={styles.label}>Reviewer name</span>
                <input
                  className={ui.input}
                  value={form.authorName}
                  onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                  placeholder="Sarah M."
                  maxLength={300}
                />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Date</span>
                <input
                  className={ui.input}
                  type="date"
                  value={form.date}
                  max={todayInputValue()}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Rating</span>
              <StarRatingInput
                value={form.rating}
                onChange={(rating) => setForm({ ...form, rating })}
                ariaLabel="Rating out of five"
              />
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Title</span>
              <input
                className={ui.input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Optional — the review's headline"
                maxLength={500}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Comment</span>
              <textarea
                className={ui.textarea}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={4}
                placeholder="What the reviewer wrote"
                maxLength={5000}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.label}>
                Photos
                <span className={styles.labelCount}>
                  {form.media.length} / {MAX_MEDIA}
                </span>
              </span>
              <div className={styles.mediaRow}>
                {form.media.map((m) => (
                  <div key={m.key} className={styles.mediaTile}>
                    {m.type === "video" ? (
                      <video src={m.url ?? undefined} muted playsInline className={styles.mediaImg} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      m.url && <img src={m.url} alt="" className={styles.mediaImg} />
                    )}
                    <button
                      type="button"
                      className={styles.mediaRemove}
                      onClick={() => setForm({ ...form, media: form.media.filter((x) => x.key !== m.key) })}
                      aria-label="Remove photo"
                    >
                      <X size={12} strokeWidth={2.6} />
                    </button>
                  </div>
                ))}
                {form.media.length < MAX_MEDIA && (
                  <MediaPicker
                    value={null}
                    mediaType="image"
                    label="photos"
                    // Multi-select: a review usually arrives with a batch of
                    // photos, and adding them one dialog at a time is the slow
                    // part of entering one.
                    multi
                    onSelectMulti={addMedia}
                    asAddTile
                    className={styles.mediaAdd}
                  />
                )}
              </div>
              <span className={styles.hint}>
                Upload the reviewer&rsquo;s photos to the media library first, then pick them here — you can select
                several at once. Up to {MAX_MEDIA}.
              </span>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Source link</span>
              <input
                className={ui.input}
                value={form.sourceUrl}
                onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                placeholder="https://… — where you copied it from"
                maxLength={1000}
              />
              <span className={styles.hint}>Your own record of where this came from. Never shown to customers.</span>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
