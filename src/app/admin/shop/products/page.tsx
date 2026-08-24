"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import styles from "./Products.module.css";
import { useToast } from "@/components/toast/ToastContext";

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

interface ProductListItem {
  id: string;
  title: string;
  sku: string | null;
  status: string;
  featured: boolean;
  isTestProduct: boolean;
  freeShipping: boolean;
  basePriceCents: number | null;
  featuredImageUrl: string | null;
  deletedAt?: string | null;
}

type Tab = "active" | "trash";

function statusBadgeCls(status: string): string {
  const map: Record<string, string> = {
    active: styles.badgeActive,
    draft: styles.badgeDraft,
    archived: styles.badgeArchived,
    hidden: styles.badgeHidden,
  };
  return map[status] ?? styles.badgeDraft;
}

function formatPrice(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

export default function AdminProductsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("active");
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: String(limit), offset: String((page - 1) * limit) });
      if (search) qs.set("search", search);
      if (tab === "active" && status) qs.set("status", status);
      const url = tab === "trash" ? `/next-api/admin/shop/products/deleted?${qs}` : `/next-api/admin/shop/products?${qs}`;
      const data = await api.get<{ items: ProductListItem[]; total: number }>(url);
      setProducts(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, status]);

  function switchTab(next: Tab) {
    setTab(next);
    setPage(1);
    setSearch("");
    setStatus("");
  }

  async function handleDelete(id: string) {
    if (!confirm("Move this product to Trash?")) return;
    try {
      await api.delete(`/next-api/admin/shop/products/${id}`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => t - 1);
      toast.success("Product moved to Trash");
    } catch (err) {
      toast.error(errMessage(err, "Failed to delete product"));
    }
  }

  async function handlePublish(id: string) {
    try {
      await api.post(`/next-api/admin/shop/products/${id}/publish`, {});
      load();
      toast.success("Product published");
    } catch (err) {
      toast.error(errMessage(err, "Failed to publish product"));
    }
  }

  async function handleRestore(id: string) {
    try {
      await api.post(`/next-api/admin/shop/products/${id}/restore`, {});
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => t - 1);
      toast.success("Product restored");
    } catch (err) {
      toast.error(errMessage(err, "Failed to restore product"));
    }
  }

  async function handleHardDelete(id: string) {
    if (!confirm("Permanently delete this product? This cannot be undone.")) return;
    try {
      await api.delete(`/next-api/admin/shop/products/${id}/permanent`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => t - 1);
      toast.success("Product permanently deleted");
    } catch (err) {
      toast.error(errMessage(err, "Failed to permanently delete product"));
    }
  }

  const pages = Math.ceil(total / limit);

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Products</h1>
          <span className={styles.subtitle}>
            {total} {tab === "trash" ? "deleted" : "total"} products
          </span>
        </div>
        {tab === "active" && (
          <Link href="/admin/shop/products/new" className={styles.newBtn}>
            + New Product
          </Link>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "active" ? styles.tabActive : ""}`} onClick={() => switchTab("active")}>
          Products
        </button>
        <button className={`${styles.tab} ${tab === "trash" ? styles.tabActive : ""}`} onClick={() => switchTab("trash")}>
          Trash
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder={tab === "trash" ? "Search deleted products…" : "Search products…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                load();
              }
            }}
          />
        </div>
        {tab === "active" && (
          <select
            className={styles.filterSelect}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="hidden">Hidden</option>
          </select>
        )}
        <div className={styles.toolbarRight}>{total} products</div>
      </div>

      {/* ── Grid ── */}
      <div className={styles.grid}>
        {loading ? (
          Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <span className={styles.skeleton} style={{ display: "block", height: 160 }} />
              <div style={{ padding: "14px 16px 16px" }}>
                <span className={styles.skeleton} style={{ height: 14, width: "70%", display: "block", marginBottom: 8 }} />
                <span className={styles.skeleton} style={{ height: 12, width: "40%", display: "block" }} />
              </div>
            </div>
          ))
        ) : products.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📦</span>
            <span className={styles.emptyText}>{tab === "trash" ? "Trash is empty" : "No products found"}</span>
            {tab === "active" && <span className={styles.emptyHint}>Create your first product to get started</span>}
          </div>
        ) : (
          products.map((p) => (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardImage}>
                {p.featuredImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.featuredImageUrl} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div className={styles.cardImagePlaceholder}>🖼</div>
                )}
                {p.featured && <span className={styles.cardFeaturedBadge}>Featured</span>}
                {p.isTestProduct && (
                  <span className={styles.cardTestBadge} title="Cannot be sold — checkout is refused">
                    Test
                  </span>
                )}
                {p.freeShipping && (
                  <span className={styles.cardFreeShipBadge} title="Delivery offered — the whole basket ships free with this product">
                    ✓ Free shipping
                  </span>
                )}
              </div>

              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}>{p.title}</h3>
                <div className={styles.cardMeta}>
                  <span className={styles.cardSku}>{p.sku ?? "—"}</span>
                  <span className={styles.cardPrice}>{formatPrice(p.basePriceCents)}</span>
                </div>
              </div>

              <div className={styles.cardFooter}>
                {tab === "active" && <span className={`${styles.badge} ${statusBadgeCls(p.status)}`}>{p.status}</span>}
                {tab === "trash" && p.deletedAt && (
                  <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--foreground) 45%, transparent)" }}>
                    {new Date(p.deletedAt).toLocaleDateString()}
                  </span>
                )}

                <div className={styles.actions}>
                  {tab === "active" && (
                    <>
                      <Link href={`/admin/shop/products/${p.id}`} className={`${styles.actionBtn} ${styles.actionEdit}`}>
                        Edit
                      </Link>
                      {p.status === "draft" && (
                        <button onClick={() => handlePublish(p.id)} className={`${styles.actionBtn} ${styles.actionPublish}`}>
                          Publish
                        </button>
                      )}
                      <button onClick={() => handleDelete(p.id)} className={`${styles.actionBtn} ${styles.actionTrash}`}>
                        Delete
                      </button>
                    </>
                  )}
                  {tab === "trash" && (
                    <>
                      <button onClick={() => handleRestore(p.id)} className={`${styles.actionBtn} ${styles.actionRestore}`}>
                        Restore
                      </button>
                      <button onClick={() => handleHardDelete(p.id)} className={`${styles.actionBtn} ${styles.actionDelete}`}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageCount}>{total} products</span>
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)} className={`${styles.pageBtn} ${page === i + 1 ? styles.pageBtnActive : ""}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
