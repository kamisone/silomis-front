"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PackageCheck, Search } from "lucide-react";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { SendInJobPanel, SEND_IN_LABEL, type SendInJob, type SendInStatus } from "@/components/admin/shop/SendInJobPanel";
import styles from "../personalization/personalization.module.css";

interface ListResponse {
  total: number;
  counts: Record<SendInStatus, number>;
  items: SendInJob[];
}

/** The states worth a tab, in the order a parcel moves through them. */
const TABS: (SendInStatus | "all")[] = ["awaiting_item", "received", "in_production", "done", "returned", "problem", "all"];

/**
 * The send-in desk: every item a customer has posted in, or is about to.
 * Same shell as the embroidery queue — tabs by state, a search, one card
 * per job — because the same people work both, one after the other.
 */
export default function SendInDeskPage() {
  const [status, setStatus] = useState<SendInStatus | "all">("awaiting_item");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams({ status, limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      setData(await api.get<ListResponse>(`/next-api/admin/shop/send-in?${params}`));
    } catch {
      setError("Could not load the send-in desk.");
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const onJobChange = useCallback(
    (job: SendInJob) => {
      setData((prev) => (prev ? { ...prev, items: prev.items.map((r) => (r.id === job.id ? job : r)) } : prev));
      void load();
    },
    [load],
  );

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Send-in items</h1>
        <Link href="/admin/shop/send-in/item-types" className={ui.badge}>
          Item types &amp; prices →
        </Link>
      </div>
      <p className={ui.pageHint}>
        Items customers have posted in for embroidery, on paid orders. Each step you mark here is shown on their tracking page
        and emailed to them — with the photos you attach.
      </p>

      <div className={ui.kpiStrip}>
        {(["awaiting_item", "received", "in_production", "done", "returned"] as SendInStatus[]).map((s) => (
          <div key={s} className={ui.kpiCard}>
            <span className={ui.kpiLabel}>{SEND_IN_LABEL[s]}</span>
            <span className={ui.kpiValue}>{data?.counts?.[s] ?? 0}</span>
          </div>
        ))}
      </div>

      <div className={ui.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Send-in status">
          {TABS.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={status === s} className={`${styles.tab} ${status === s ? styles.tabActive : ""}`} onClick={() => setStatus(s)}>
              {s === "all" ? "All" : SEND_IN_LABEL[s]}
              {s !== "all" && data?.counts?.[s] ? <span className={styles.tabCount}>{data.counts[s]}</span> : null}
            </button>
          ))}
        </div>
        <div className={styles.searchWrap}>
          <Search size={15} aria-hidden="true" className={styles.searchIcon} />
          <input className={ui.searchInput} placeholder="Order number, customer name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <p className={ui.error}>{error}</p>}

      {loading && !data ? (
        <p className={ui.muted}>Loading…</p>
      ) : !data?.items.length ? (
        <div className={ui.emptyState}>
          <PackageCheck size={22} aria-hidden="true" />
          <p>Nothing here.</p>
        </div>
      ) : (
        <div className={styles.jobGrid}>
          {data.items.map((job) => (
            <SendInJobPanel key={job.id} job={job} onChange={onJobChange} />
          ))}
        </div>
      )}
    </div>
  );
}
