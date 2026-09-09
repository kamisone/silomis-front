"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Play } from "lucide-react";
import { api } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import SessionReplayModal from "@/components/admin/shop/SessionReplayModal";
import AnalyticsDetailModal, { TEST_EVENT_TYPES } from "@/components/admin/shop/AnalyticsDetailModal";
import ProductPicker from "@/components/admin/shop/ProductPicker";
import replayStyles from "@/components/admin/shop/SessionReplay.module.css";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./TestProducts.module.css";

type Scope = "test" | "live";

const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: "test", label: "Tests" },
  { value: "live", label: "Live" },
];

interface CountryOption {
  isoCode: string;
  name: string;
}

/** Matches Country.continentCode in the schema — the column countryCodesFor filters on. */
const CONTINENT_OPTIONS = [
  { value: "AF", label: "Africa" },
  { value: "AS", label: "Asia" },
  { value: "EU", label: "Europe" },
  { value: "NA", label: "North America" },
  { value: "SA", label: "South America" },
  { value: "OC", label: "Oceania" },
  { value: "AN", label: "Antarctica" },
];

/**
 * Shortest first, so the default sits at the top and the two shortest windows
 * read against each other.
 *
 * "Last 2 days" is not "Yesterday": a numeric preset is a rolling window
 * ending now (resolveWindow: since = now - N x 24h), so it is the last 48
 * hours — today plus yesterday — while "Yesterday" is that one calendar day
 * alone, today excluded.
 */
const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "2", label: "Last 2 days" },
  { value: "3", label: "Last 3 days" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "month", label: "This month" },
  { value: "lastmonth", label: "Last month" },
  { value: "custom", label: "Custom range…" },
];

const LIMIT_OPTIONS = [
  { value: "10", label: "Top 10" },
  { value: "20", label: "Top 20" },
  { value: "50", label: "Top 50" },
];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * A preset becomes the concrete window the API takes. Named ranges resolve to
 * explicit start/end dates rather than a day count, so "This month" on the 3rd
 * means three days, not thirty.
 */
function dateRangeToQuery(range: string, startDate: string, endDate: string): Record<string, string> {
  const now = new Date();
  const today = fmtDate(now);

  switch (range) {
    case "today":
      return { startDate: today, endDate: today };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { startDate: fmtDate(y), endDate: fmtDate(y) };
    }
    case "month":
      return { startDate: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: today };
    case "lastmonth":
      return {
        startDate: fmtDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        // Day 0 of this month is the last day of the previous one.
        endDate: fmtDate(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "custom":
      return { ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) };
    default:
      return { days: range };
  }
}

interface TestProductDemand {
  productId: string;
  title: string;
  slug: string;
  status: string;
  /** The flag TODAY. A row whose flag disagrees with the tab it is on is a
   *  product that changed phase and still has history here. */
  isTestProduct: boolean;
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
  /**
   * Which phase of the catalogue this page is reporting on. Not derived from
   * the product's flag today: the backend matches it against the state
   * recorded on each event, so a product promoted from test to live appears in
   * both tabs, each showing only the events from its own phase.
   */
  const [scope, setScope] = useState<Scope>("test");
  const [range, setRange] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [productId, setProductId] = useState("");
  const [limit, setLimit] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [continent, setContinent] = useState("");
  const [status, setStatus] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minViews, setMinViews] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [reachedCheckoutOnly, setReachedCheckoutOnly] = useState(false);
  const [sort, setSort] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [rows, setRows] = useState<TestProductDemand[]>([]);
  /** First load only — a refetch keeps the previous rows on screen. */
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [replayProduct, setReplayProduct] = useState<{ id: string; title: string } | null>(null);
  const [detailProduct, setDetailProduct] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    fetch("/next-api/admin/shop/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCategories(Array.isArray(data) ? data : (data.items ?? [])))
      .catch(() => {});
    fetch("/next-api/admin/shop/countries")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCountries(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams(dateRangeToQuery(range, startDate, endDate));
    params.set("scope", scope);
    if (productId) params.set("productId", productId);
    if (limit) params.set("limit", limit);
    if (categoryId) params.set("categoryId", categoryId);
    // Mutually exclusive by construction (see the selects): the backend reads
    // countryCode first and would otherwise silently ignore the continent.
    if (countryCode) params.set("countryCode", countryCode);
    else if (continent) params.set("continent", continent);
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
  }, [scope, range, startDate, endDate, productId, limit, categoryId, countryCode, continent, status, minPrice, maxPrice, minViews, activeOnly, reachedCheckoutOnly, sort, order]);

  /** Date window + country scope, so the modal opens on the same slice the table is showing. */
  const windowParams = useMemo(() => {
    const p: Record<string, string> = { ...dateRangeToQuery(range, startDate, endDate), scope };
    if (countryCode) p.countryCode = countryCode;
    else if (continent) p.continent = continent;
    return p;
  }, [scope, range, startDate, endDate, countryCode, continent]);

  const filtersActive =
    !!productId || !!limit || !!categoryId || !!countryCode || !!continent || !!status || !!minPrice || !!maxPrice || !!minViews || activeOnly || reachedCheckoutOnly;

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
      const params = new URLSearchParams({ ...dateRangeToQuery(range, startDate, endDate), scope, productIds: productIds.join(",") });
      fetch(`/next-api/admin/shop/analytics/replay/unread-counts?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((data: Record<string, number>) => setUnreadCounts(data && typeof data === "object" ? data : {}))
        .catch(() => {});
    },
    [scope, range, startDate, endDate],
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
    setProductId("");
    setLimit("");
    setCategoryId("");
    setCountryCode("");
    setContinent("");
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
  const periodLabel =
    range === "custom"
      ? [startDate, endDate].filter(Boolean).join(" → ") || "custom range"
      : (DATE_PRESETS.find((p) => p.value === range)?.label ?? range).toLowerCase();

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Product demand</h1>
      </div>

      {/* Two reports over one funnel, so the tab is the whole switch — every
          filter, the table and the drill-downs all follow it. */}
      <div className={styles.tabs} role="tablist" aria-label="Catalogue phase">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={scope === s.value}
            className={`${styles.tab} ${scope === s.value ? styles.tabActive : ""}`}
            onClick={() => setScope(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className={ui.pageHint} style={{ maxWidth: 760 }}>
        {scope === "test" ? (
          <>
            Test products behave like real products until checkout, which is refused before the payment form loads.{" "}
            <strong>Reached shipping</strong> counts customers who submitted their address and landed on the shipping step;{" "}
            <strong>reached checkout</strong> counts those who then chose a shipping method and clicked through to payment — the
            furthest a test product can be taken, and the people who would have bought it.
          </>
        ) : (
          <>
            The same funnel for products actually on sale. <strong>Reached shipping</strong> counts customers who submitted their
            address; <strong>reached checkout</strong> counts those who chose a shipping method and clicked through to payment.
            Nothing is refused here, so the drop-off after that step is customers who reached the payment form and did not pay.
          </>
        )}{" "}
        Both are counted once per customer, so retries do not inflate them. A product keeps the phase it was in when each event
        happened, so promoting one from test to live leaves its earlier numbers on the Tests tab rather than moving them here.
      </p>

      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Date range</span>
            <select className={styles.control} value={range} onChange={(e) => setRange(e.target.value)}>
              {DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {/* Only while "Custom range…" is chosen — two empty date boxes on
              every other preset are two controls that do nothing. Each bounds
              the other so an inverted window cannot be picked. */}
          {range === "custom" && (
            <>
              <label className={styles.filter}>
                <span className={styles.filterLabel}>From</span>
                <input className={styles.control} type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label className={styles.filter}>
                <span className={styles.filterLabel}>To</span>
                <input className={styles.control} type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </>
          )}
          <ProductPicker
            value={productId}
            onChange={setProductId}
            scope={scope}
            placeholder={scope === "test" ? "Search test products…" : "Search live products…"}
          />
          {/* Picking one clears the other: the backend resolves countryCode
              before continent, so leaving both set would quietly drop the
              continent and show a scope the controls do not describe. */}
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Continent</span>
            <select
              className={styles.control}
              value={continent}
              onChange={(e) => {
                setContinent(e.target.value);
                setCountryCode("");
              }}
            >
              <option value="">All continents</option>
              {CONTINENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Country</span>
            <select
              className={styles.control}
              value={countryCode}
              onChange={(e) => {
                setCountryCode(e.target.value);
                setContinent("");
              }}
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c.isoCode} value={c.isoCode}>
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
          <label className={`${styles.filter} ${styles.numFilter}`}>
            <span className={styles.filterLabel}>Min price</span>
            <div className={styles.numWrap}>
              <span className={styles.numPrefix} aria-hidden="true">€</span>
              <input className={`${styles.control} ${styles.num}`} type="number" min={0} step="0.01" placeholder="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
            </div>
          </label>
          <label className={`${styles.filter} ${styles.numFilter}`}>
            <span className={styles.filterLabel}>Max price</span>
            <div className={styles.numWrap}>
              <span className={styles.numPrefix} aria-hidden="true">€</span>
              <input className={`${styles.control} ${styles.num}`} type="number" min={0} step="0.01" placeholder="∞" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>
          </label>
          <label className={`${styles.filter} ${styles.numFilter}`}>
            <span className={styles.filterLabel}>Min views</span>
            <input className={`${styles.control} ${styles.num}`} type="number" min={0} placeholder="0" value={minViews} onChange={(e) => setMinViews(e.target.value)} />
          </label>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Show</span>
            <select className={styles.control} value={limit} onChange={(e) => setLimit(e.target.value)}>
              <option value="">All</option>
              {LIMIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.filterFooter}>
          <div className={styles.toggles}>
            <label className={styles.toggle}>
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
              <span className={styles.toggleDot} aria-hidden="true">
                <Check size={9} strokeWidth={3.5} />
              </span>
              Hide no activity
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={reachedCheckoutOnly} onChange={(e) => setReachedCheckoutOnly(e.target.checked)} />
              <span className={styles.toggleDot} aria-hidden="true">
                <Check size={9} strokeWidth={3.5} />
              </span>
              Reached checkout only
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
            {scope === "test"
              ? "No test products match these filters. Turn on “Test product” on a product, or loosen the filters above."
              : "No live products match these filters. Loosen the filters above, or check the Tests tab if the product you are looking for is still in testing."}
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
                  // The row is the drill-down: the numbers are aggregates, and
                  // the only way to tell a real signal from one visitor
                  // refreshing is to see the events behind them.
                  <tr
                    key={r.productId}
                    className={styles.clickableRow}
                    tabIndex={0}
                    role="button"
                    aria-label={`Show events for ${r.title}`}
                    onClick={() => setDetailProduct({ id: r.productId, title: r.title })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailProduct({ id: r.productId, title: r.title });
                      }
                    }}
                  >
                    <td>
                      {/* Stops the link from also opening the modal underneath it. */}
                      <Link href={`/admin/shop/products/${r.productId}`} onClick={(e) => e.stopPropagation()}>
                        {r.title}
                      </Link>
                      {/* Says why a product is listed under a tab its current
                          flag disagrees with: these are the numbers from the
                          phase it used to be in. */}
                      {scope === "test" && !r.isTestProduct && <span className={styles.phaseChip}>Promoted to live</span>}
                      {scope === "live" && r.isTestProduct && <span className={styles.phaseChip}>Back in testing</span>}
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
                      <button
                        type="button"
                        className={replayStyles.replayBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplayProduct({ id: r.productId, title: r.title });
                        }}
                      >
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

      {detailProduct && (
        <AnalyticsDetailModal
          open
          onClose={() => setDetailProduct(null)}
          title={detailProduct.title}
          subtitle="Every event behind this row — country, device, source and IP"
          // The same window and country scope the table is showing, so the
          // detail can never disagree with the number that was clicked.
          params={{ ...windowParams, productId: detailProduct.id, eventType: TEST_EVENT_TYPES, limit: "200" }}
        />
      )}

      {replayProduct && (
        <SessionReplayModal
          productId={replayProduct.id}
          productTitle={replayProduct.title}
          windowParams={windowParams}
          onClose={() => {
            setReplayProduct(null);
            fetchUnreadCounts(rows.map((r) => r.productId));
          }}
        />
      )}
    </div>
  );
}
