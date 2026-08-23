"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import SessionReplayModal from "@/components/admin/shop/SessionReplayModal";
import replayStyles from "@/components/admin/shop/SessionReplay.module.css";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface TestProductDemand {
  productId: string;
  title: string;
  slug: string;
  status: string;
  views: number;
  addsToCart: number;
  reachedShipping: number;
  reachedCheckout: number;
  viewToCartRatePct: number;
  cartToShippingRatePct: number;
  cartToCheckoutRatePct: number;
  viewToCheckoutRatePct: number;
}

interface CategoryOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "hidden", label: "Hidden" },
];

// Sortable numeric columns -> server sort keys.
const SORT_COLUMNS: Array<{ key: keyof TestProductDemand; label: string }> = [
  { key: "views", label: "Views" },
  { key: "addsToCart", label: "Added to cart" },
  { key: "reachedShipping", label: "Reached shipping" },
  { key: "reachedCheckout", label: "Reached checkout" },
  { key: "viewToCartRatePct", label: "View → cart" },
  { key: "cartToShippingRatePct", label: "Cart → shipping" },
  { key: "cartToCheckoutRatePct", label: "Cart → checkout" },
  { key: "viewToCheckoutRatePct", label: "View → checkout" },
];

export default function TestProductsAnalyticsPage() {
  const [days, setDays] = useState("30");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minViews, setMinViews] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [reachedCheckoutOnly, setReachedCheckoutOnly] = useState(false);
  const [sort, setSort] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [rows, setRows] = useState<TestProductDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [replayProduct, setReplayProduct] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    fetch("/next-api/admin/shop/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCategories(Array.isArray(data) ? data : (data.items ?? [])))
      .catch(() => {});
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams({ days });
    if (search) params.set("search", search);
    if (categoryId) params.set("categoryId", categoryId);
    if (status) params.set("productStatus", status);
    if (minPrice) params.set("minPriceCents", String(Math.round(Number(minPrice) * 100)));
    if (maxPrice) params.set("maxPriceCents", String(Math.round(Number(maxPrice) * 100)));
    if (minViews) params.set("minViews", minViews);
    if (activeOnly) params.set("activeOnly", "true");
    if (reachedCheckoutOnly) params.set("reachedCheckoutOnly", "true");
    if (sort) {
      params.set("sort", sort);
      params.set("order", order);
    }
    return params.toString();
  }, [days, search, categoryId, status, minPrice, maxPrice, minViews, activeOnly, reachedCheckoutOnly, sort, order]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api
        .get<TestProductDemand[]>(`/next-api/admin/shop/analytics/test-products?${query}`)
        .then((data) => setRows(Array.isArray(data) ? data : []))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, [query]);

  // Unread session-replay count per product, for the "Replays" badge — refreshed
  // whenever the row set changes, and again after a replay modal closes (opening
  // a session there marks it viewed server-side).
  const fetchUnreadCounts = useCallback(
    (productIds: string[]) => {
      if (!productIds.length) {
        setUnreadCounts({});
        return;
      }
      const params = new URLSearchParams({ days, productIds: productIds.join(",") });
      fetch(`/next-api/admin/shop/analytics/replay/unread-counts?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((data: Record<string, number>) => setUnreadCounts(data && typeof data === "object" ? data : {}))
        .catch(() => {});
    },
    [days],
  );

  useEffect(() => {
    const t = setTimeout(() => fetchUnreadCounts(rows.map((r) => r.productId)), 0);
    return () => clearTimeout(t);
  }, [rows, fetchUnreadCounts]);

  const totals = rows.reduce(
    (acc, r) => ({
      views: acc.views + r.views,
      addsToCart: acc.addsToCart + r.addsToCart,
      reachedShipping: acc.reachedShipping + r.reachedShipping,
      reachedCheckout: acc.reachedCheckout + r.reachedCheckout,
    }),
    { views: 0, addsToCart: 0, reachedShipping: 0, reachedCheckout: 0 },
  );

  function toggleSort(key: string) {
    if (sort === key) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setOrder("desc");
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Test products</h1>
      </div>

      <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)", maxWidth: 760, lineHeight: 1.6, marginTop: "-0.5rem" }}>
        Test products behave like real products until checkout, which is refused before the payment form loads. <strong>Reached shipping</strong> counts customers who submitted their address and landed on the shipping step; <strong>reached checkout</strong> counts those who then chose a
        shipping method and clicked through to payment — the furthest a test product can be taken, and the people who would have bought it. Both are counted once per customer, so retries after the error do not inflate them.
      </p>

      <div className={ui.toolbar}>
        <select className={ui.select} value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <input className={ui.searchInput} placeholder="Search title…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={ui.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={ui.select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input className={ui.input} style={{ width: 90 }} type="number" min={0} placeholder="Min €" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        <input className={ui.input} style={{ width: 90 }} type="number" min={0} placeholder="Max €" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <input className={ui.input} style={{ width: 90 }} type="number" min={0} placeholder="Min views" value={minViews} onChange={(e) => setMinViews(e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem" }}>
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Hide no activity
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem" }}>
          <input type="checkbox" checked={reachedCheckoutOnly} onChange={(e) => setReachedCheckoutOnly(e.target.checked)} /> Reached checkout only
        </label>
      </div>

      {loading ? (
        <div className={ui.emptyState}>Loading…</div>
      ) : rows.length === 0 ? (
        <div className={ui.emptyState}>No test products match these filters. Turn on &ldquo;Test product&rdquo; on a product, or loosen the filters above.</div>
      ) : (
        <>
          <div className={ui.card} style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)", textTransform: "uppercase" }}>Test products</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{rows.length}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)", textTransform: "uppercase" }}>Views</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{totals.views}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)", textTransform: "uppercase" }}>Added to cart</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{totals.addsToCart}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)", textTransform: "uppercase" }}>Reached shipping</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{totals.reachedShipping}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)", textTransform: "uppercase" }}>Reached checkout</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#b45309" }}>{totals.reachedCheckout}</div>
            </div>
          </div>

          <div className={ui.card} style={{ overflowX: "auto" }}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  {SORT_COLUMNS.map((col) => (
                    <th key={col.key} style={{ cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => toggleSort(col.key)}>
                      {col.label} {sort === col.key ? (order === "asc" ? "▲" : "▼") : ""}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.productId}>
                    <td>
                      <Link href={`/admin/shop/products/${r.productId}`}>{r.title}</Link>
                    </td>
                    <td>{r.views}</td>
                    <td>{r.addsToCart}</td>
                    <td>{r.reachedShipping}</td>
                    <td style={{ fontWeight: 700, color: "#b45309" }}>{r.reachedCheckout}</td>
                    <td>{r.viewToCartRatePct}%</td>
                    <td>{r.cartToShippingRatePct}%</td>
                    <td>{r.cartToCheckoutRatePct}%</td>
                    <td>{r.viewToCheckoutRatePct}%</td>
                    <td>
                      <button type="button" className={replayStyles.replayBtn} onClick={() => setReplayProduct({ id: r.productId, title: r.title })}>
                        ▶ Replays
                        {!!unreadCounts[r.productId] && <span className={replayStyles.unreadBadge}>{unreadCounts[r.productId]}</span>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {replayProduct && (
        <SessionReplayModal
          productId={replayProduct.id}
          productTitle={replayProduct.title}
          onClose={() => {
            setReplayProduct(null);
            fetchUnreadCounts(rows.map((r) => r.productId));
          }}
        />
      )}
    </div>
  );
}
