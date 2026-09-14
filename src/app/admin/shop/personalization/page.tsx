"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Scissors } from "lucide-react";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";
import {
  EmbroideryJobCard,
  PRODUCTION_STATUSES,
  STATUS_LABEL,
  type EmbroideryJob,
  type ProductionStatus,
} from "@/components/admin/shop/EmbroideryJob";
import styles from "./personalization.module.css";

interface QueueResponse {
  total: number;
  /** Jobs on orders that have not been paid — deliberately not in the queue. */
  unpaidJobs: number;
  counts: Record<ProductionStatus, number>;
  items: EmbroideryJob[];
}

/**
 * The embroidery production queue.
 *
 * Every paid, personalised line, oldest first. The card itself lives in
 * EmbroideryJobCard so the order page shows exactly the same thing; this
 * screen only adds the tabs, the search and the totals.
 */
export default function PersonalizationQueuePage() {
  const [status, setStatus] = useState<ProductionStatus | "all">("pending");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status, limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      setData(await api.get<QueueResponse>(`/next-api/admin/shop/personalization/queue?${params}`));
    } catch {
      setError("Could not load the production queue.");
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  // Debounced so typing an order number does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  /**
   * A saved card replaces its row in place; a status change also moves the
   * job between tabs, so the counts are re-read rather than guessed.
   */
  const onJobChange = useCallback(
    (job: EmbroideryJob) => {
      setData((prev) => (prev ? { ...prev, items: prev.items.map((r) => (r.id === job.id ? job : r)) } : prev));
      void load();
    },
    [load],
  );

  const totalStitches = useMemo(() => (data?.items ?? []).reduce((sum, r) => sum + r.stitchEstimate * r.quantity, 0), [data]);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Embroidery production</h1>
      </div>
      <p className={ui.pageHint}>
        Every personalised line on a paid order, in the order it was placed. The text shown is exactly what gets stitched.
      </p>

      <div className={ui.kpiStrip}>
        {PRODUCTION_STATUSES.map((s) => (
          <div key={s} className={ui.kpiCard}>
            <span className={ui.kpiLabel}>{STATUS_LABEL[s]}</span>
            <span className={ui.kpiValue}>{data?.counts?.[s] ?? 0}</span>
          </div>
        ))}
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Stitches in view</span>
          <span className={ui.kpiValue}>{totalStitches.toLocaleString()}</span>
        </div>
      </div>

      <div className={ui.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Production status">
          {(["all", ...PRODUCTION_STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              className={`${styles.tab} ${status === s ? styles.tabActive : ""}`}
              onClick={() => setStatus(s)}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
              {s !== "all" && data?.counts?.[s] ? <span className={styles.tabCount}>{data.counts[s]}</span> : null}
            </button>
          ))}
        </div>

        <div className={styles.searchWrap}>
          <Search size={15} aria-hidden="true" className={styles.searchIcon} />
          <input
            className={ui.searchInput}
            placeholder="Order number, customer, product or embroidered text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <p className={ui.error}>{error}</p>}

      {data && data.unpaidJobs > 0 && (
        <p className={ui.muted} role="status">
          {data.unpaidJobs} {data.unpaidJobs === 1 ? "job is" : "jobs are"} on orders still awaiting payment and will appear here once paid.
        </p>
      )}

      {loading && !data ? (
        <p className={ui.muted}>Loading…</p>
      ) : !data?.items.length ? (
        <div className={ui.emptyState}>
          <Scissors size={22} aria-hidden="true" />
          <p>Nothing in this queue.</p>
        </div>
      ) : (
        <div className={styles.jobGrid}>
          {data.items.map((row) => (
            <EmbroideryJobCard key={row.id} job={row} onChange={onJobChange} />
          ))}
        </div>
      )}
    </div>
  );
}
