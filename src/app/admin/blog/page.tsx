"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { api } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { useToast } from "@/components/toast/ToastContext";

type Status = "draft" | "scheduled" | "published" | "archived";

interface Category { id: string; name: string; color: string | null; }
interface Tag { id: string; name: string; }

interface Post {
  id: string;
  title: string;
  slug: string;
  status: Status;
  featured: boolean;
  authorName: string | null;
  readingTimeMinutes: number;
  publishedAt: string | null;
  scheduledPublishAt: string | null;
  categories: Category[];
  tags: Tag[];
  createdAt: string;
}

interface ListResult { items: Post[]; total: number; }

const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft", scheduled: "Scheduled", published: "Published", archived: "Archived",
};
const PAGE_SIZE = 20;

export default function BlogPostsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);

    api.get<ListResult>(`/next-api/admin/blog/posts?${params}`)
      .then((d) => { setItems(d.items); setTotal(d.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function deletePost(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await api.delete(`/next-api/admin/blog/posts/${id}`);
      toast.success("Article deleted");
      load();
    } catch {
      toast.error("Failed to delete article");
    }
  }

  async function publishPost(id: string) {
    try {
      await api.post(`/next-api/admin/blog/posts/${id}/publish`);
      toast.success("Article published");
      load();
    } catch {
      toast.error("Failed to publish article");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Articles</h1>
        <Link href="/admin/blog/new">
          <Button>New article</Button>
        </Link>
      </div>

      <div className={ui.toolbar}>
        <input
          className={ui.searchInput}
          placeholder="Search by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={ui.select} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>
            No articles yet. <Link href="/admin/blog/new" style={{ color: "var(--color-accent)" }}>Create the first one →</Link>
          </div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Article</th>
                <th>Status</th>
                <th>Categories</th>
                <th>Published</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((post) => (
                <tr key={post.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {post.featured && <Star size={14} strokeWidth={1.75} style={{ color: "var(--color-accent)", flexShrink: 0 }} />}
                      <div>
                        <div style={{ fontWeight: 600 }}>{post.title || "(untitled)"}</div>
                        <div className={ui.muted} style={{ fontSize: "0.78rem" }}>/{post.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={ui.badge}>{STATUS_LABELS[post.status]}</span>
                  </td>
                  <td>
                    <div className={ui.chipList}>
                      {post.categories.map((c) => (
                        <span key={c.id} className={ui.chip}>{c.name}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString()
                      : post.scheduledPublishAt
                        ? `Scheduled ${new Date(post.scheduledPublishAt).toLocaleDateString()}`
                        : "—"}
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Link href={`/admin/blog/${post.id}/edit`}>
                        <Button variant="secondary">Edit</Button>
                      </Link>
                      {post.status !== "published" && (
                        <Button variant="secondary" onClick={() => publishPost(post.id)}>Publish</Button>
                      )}
                      <Button variant="danger" onClick={() => deletePost(post.id, post.title)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className={ui.toolbar} style={{ justifyContent: "space-between" }}>
          <span className={ui.muted}>{total} articles · page {page + 1} / {totalPages}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</Button>
            <Button variant="secondary" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next →</Button>
          </div>
        </div>
      )}
    </div>
  );
}
