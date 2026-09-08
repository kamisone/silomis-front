"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Play } from "lucide-react";
import { api } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import SessionReplayModal from "@/components/admin/shop/SessionReplayModal";
import replayStyles from "@/components/admin/shop/SessionReplay.module.css";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./TestProducts.module.css";

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

/** Typing in the filters refetches; this is how long typing has to stop first. */
const SEARCH_DEBOUNCE_MS = 350;

/** Euros as typed -> cents, or null when the box holds nothing usable. */
function toCents(value: string): string | null {
  if (!value.trim()) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isFinite(cents) ? String(cents) : null;
}

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
  /** First load only — a refetch keeps the previous rows on screen. */
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
    if (search.trim()) params.set("search", search.trim());
    if (categoryId) params.set("categoryId", categoryId);
    if (status) params.set("productStatus", status);
    // A half-typed "-" or "1e" is not a filter — sending NaN made the whole
    // request come back empty with nothing on screen to explain why.
    const min = toCents(minPrice);
    const max = toCents(maxPrice);
    if (min) params.set("minPriceCents", min);
    if (max) params.set("maxPriceCents", max);
    if (minViews.trim()) params.set("minViews", minViews.trim());
    if (activeOnly) params.set("activeOnly", "true");
    if (reachedCheckoutOnly) params.set("reachedCheckoutOnly", "true");
    if (sort) {
      params.set("sort", sort);
      params.set("order", order);
    }
    return params.toString();
  }, [days, search, categoryId, status, minPrice, maxPrice, minViews, activeOnly, reachedCheckoutOnly, sort, order]);

  const filtersActive =
    !!search.trim() || !!categoryId || !!status || !!minPrice || !!maxPrice || !!minViews || activeOnly || reachedCheckoutOnly;

  useEffect(() => {
    // Debounced: `query` changes on every keystroke in the search and number
    // boxes, and the previous zero-delay timeout fired a request for each one.
    // The dimming starts when the request does, not on the keystroke — a table
    // that greys out between letters is worse than one that just waits.
    const t = setTimeout(() => {
      setRefreshing(true);
      api
        .get<TestProductDemand[]>(`/next-api/admin/shop/analytics/test-products?${query}`)
        .then((data) => setRows(Array.isArray(data) ? data : []))
        .catch(() => setRows([]))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    }, SEARCH_DEBOUNCE_MS);
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

  function clearFilters() {
    setSearch("");
    setCategoryId("");
    setStatus("");
    setMinPrice("");
    setMaxPrice("");
    setMinViews("");
    setActiveOnly(false);
    setReachedCheckoutOnly(false);
  }

  /**
   * The four numbers are one funnel, not four unrelated counters — the whole
   * point of the page is where people fall out of it. Rendering them as a row
   * of identical cards buried that; each step now carries what share of the
   * previous step reached it.
   */
  const funnel = [
    { key: "views", label: "Viewed", value: totals.views, of: null as number | null },
    { key: "cart", label: "Added to cart", value: totals.addsToCart, of: totals.views },
    { key: "shipping", label: "Reached shipping", value: totals.reachedShipping, of: totals.addsToCart },
    { key: "checkout", label: "Reached checkout", value: totals.reachedCheckout, of: totals.reachedShipping },
  ];

  const pct = (value: number, of: number) => (of > 0 ? Math.round((value / of) * 100) : 0);
  const periodLabel = days === "7" ? "last 7 days" : days === "90" ? "last 90 days" : "last 30 days";

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Test products</h1>
      </div>

      <p className={ui.pageHint} style={{ maxWidth: 760 }}>
        Test products behave like real products until checkout, which is refused before the payment form loads. <strong>Reached shipping</strong> counts customers who submitted their address and landed on the shipping step; <strong>reached checkout</strong> counts those who then chose a
        shipping method and clicked through to payment — the furthest a test product can be taken, and the people who would have bought it. Both are counted once per customer, so retries after the error do not inflate them.
      </p>

      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <label className={`${styles.filter} ${styles.search}`}>
            <span className={styles.filterLabel}>Search</span>
            <input className={styles.control} placeholder="Product title…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Period</span>
            <select className={styles.control} value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Category</span>
            <select className={styles.control} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Status</span>
            <select className={styles.control} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any status</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {/* One field, not two: min and max are a single range, and pairing
              them inside one bordered box says so without a second label. */}
          <div className={styles.filter}>
            <span className={styles.filterLabel}>Price (€)</span>
            <div className={styles.range}>
              <input className={styles.rangeInput} type="number" min={0} step="0.01" placeholder="min" aria-label="Minimum price in euros" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              <span className={styles.rangeDash} aria-hidden="true">
                –
              </span>
              <input className={styles.rangeInput} type="number" min={0} step="0.01" placeholder="max" aria-label="Maximum price in euros" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>
          </div>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Min views</span>
            <input className={`${styles.control} ${styles.num}`} type="number" min={0} placeholder="0" value={minViews} onChange={(e) => setMinViews(e.target.value)} />
          </label>
        </div>

        <div className={styles.filterFooter}>
          <div className={styles.toggles}>
            <label className={styles.toggle}>
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Hide no activity
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={reachedCheckoutOnly} onChange={(e) => setReachedCheckoutOnly(e.target.checked)} /> Reached checkout only
            </label>
          </div>
          {filtersActive && (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Stays mounted through a refetch: it is the page's summary, and having
          it disappear on every keystroke was most of why the page felt jumpy. */}
      <section className={styles.funnelCard} aria-label="Demand funnel">
        <header className={styles.funnelHead}>
          <h2 className={styles.funnelTitle}>Demand funnel</h2>
          <span className={styles.funnelMeta}>
            {loading ? "—" : `${rows.length} test ${rows.length === 1 ? "product" : "products"}`} · {periodLabel}
          </span>
        </header>

        <ol className={styles.funnel}>
          {funnel.map((step, i) => {
            const last = i === funnel.length - 1;
            const share = step.of === null ? null : pct(step.value, step.of);
            return (
              <li key={step.key} className={`${styles.step} ${last ? styles.stepEnd : ""}`}>
                <span className={styles.stepLabel}>{step.label}</span>
                <span className={styles.stepValue}>{loading ? "—" : step.value.toLocaleString()}</span>
                <span className={styles.stepShare}>
                  {loading || share === null ? (
                    <span className={styles.stepShareStart}>start of funnel</span>
                  ) : (
                    <>
                      <span className={styles.stepPct}>{share}%</span> of previous step
                    </>
                  )}
                </span>
                {/* A bar, not a decoration: its width is the step's share of
                    the top of the funnel, so the drop-off is visible before
                    any number is read. */}
                <span className={styles.stepBarTrack} aria-hidden="true">
                  <span className={styles.stepBar} style={{ width: `${loading ? 0 : pct(step.value, totals.views)}%` }} />
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : rows.length === 0 ? (
          <div className={ui.emptyState}>
            No test products match these filters. Turn on &ldquo;Test product&rdquo; on a product, or loosen the filters above.
          </div>
        ) : (
          <div className={`${styles.tableWrap} ${refreshing ? styles.refreshing : ""}`}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  {SORT_COLUMNS.map((col) => {
                    const active = sort === col.key;
                    const Icon = active && order === "asc" ? ChevronUp : ChevronDown;
                    return (
                      <th key={col.key} aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}>
                        <button
                          type="button"
                          className={styles.sortBtn}
                          onClick={() => toggleSort(col.key)}
                          title={`Sort by ${col.label}`}
                        >
                          {col.label}
                          <Icon size={13} strokeWidth={2.4} className={`${styles.sortIcon} ${active ? styles.sortIconActive : ""}`} aria-hidden="true" />
                        </button>
                      </th>
                    );
                  })}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.productId}>
                    <td>
                      <Link href={`/admin/shop/products/${r.productId}`}>{r.title}</Link>
                    </td>
                    <td className={styles.numCell}>{r.views}</td>
                    <td className={styles.numCell}>{r.addsToCart}</td>
                    <td className={styles.numCell}>{r.reachedShipping}</td>
                    <td className={styles.checkoutCell}>{r.reachedCheckout}</td>
                    <td className={styles.rateCell}>{r.viewToCartRatePct}%</td>
                    <td className={styles.rateCell}>{r.cartToShippingRatePct}%</td>
                    <td className={styles.rateCell}>{r.cartToCheckoutRatePct}%</td>
                    <td className={styles.rateCell}>{r.viewToCheckoutRatePct}%</td>
                    <td>
                      <button type="button" className={replayStyles.replayBtn} onClick={() => setReplayProduct({ id: r.productId, title: r.title })}>
                        <Play size={12} strokeWidth={2.4} aria-hidden="true" />
                        Replays
                        {!!unreadCounts[r.productId] && <span className={replayStyles.unreadBadge}>{unreadCounts[r.productId]}</span>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {replayProduct && (
        <SessionReplayModal
          productId={replayProduct.id}
          productTitle={replayProduct.title}
          windowParams={{ days }}
          onClose={() => {
            setReplayProduct(null);
            fetchUnreadCounts(rows.map((r) => r.productId));
          }}
        />
      )}
    </div>
  );
}
