"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

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
  authorEmail: string;
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

function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export default function ReviewsAdminPage() {
  const [tab, setTab] = useState<ReviewStatus | "">("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Partial<Record<ReviewStatus, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rejecting, setRejecting] = useState<Review | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editing, setEditing] = useState<Review | null>(null);
  const [editRating, setEditRating] = useState("5");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    loadCounts();
  }, []);

  async function moderate(id: string, status: ReviewStatus, rejectionReason?: string) {
    setError(null);
    try {
      await api.patch(`/next-api/admin/shop/reviews/${id}/moderate`, { status, rejectionReason });
      await Promise.all([load(), loadCounts()]);
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Action failed") : "Action failed");
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejecting) return;
    await moderate(rejecting.id, "rejected", rejectReason || undefined);
    setRejecting(null);
    setRejectReason("");
  }

  function openEdit(r: Review) {
    setEditing(r);
    setEditRating(String(r.rating));
    setEditTitle(r.title ?? "");
    setEditBody(r.body ?? "");
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await api.patch(`/next-api/admin/shop/reviews/${editing.id}`, { rating: parseInt(editRating, 10), title: editTitle || null, body: editBody || null });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    }
  }

  async function handleDelete(r: Review) {
    if (!confirm(`Delete review by "${r.authorName}"?`)) return;
    try {
      await api.delete(`/next-api/admin/shop/reviews/${r.id}`);
      await Promise.all([load(), loadCounts()]);
    } catch (err) {
      alert(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Delete failed") : "Delete failed");
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

      {error && <p className={ui.error}>{error}</p>}

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
                    <span style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>{r.authorEmail}</span>
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
                      <Button variant="danger" onClick={() => handleDelete(r)}>
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

      {editing && (
        <Modal
          title="Edit review"
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" form="edit-review-form">
                Save
              </Button>
            </>
          }
        >
          <form id="edit-review-form" onSubmit={handleEditSave} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={ui.field}>
              <label className={ui.label}>Rating</label>
              <select className={ui.select} value={editRating} onChange={(e) => setEditRating(e.target.value)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Title</label>
              <input className={ui.input} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Body</label>
              <textarea className={ui.textarea} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
