"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Printer, Search, Scissors, FileDown } from "lucide-react";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./personalization.module.css";

/** The order the floor works a job, mirroring the backend's list. */
const STATUSES = ["pending", "digitizing", "ready", "stitched"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABEL: Record<Status, string> = {
  pending: "To digitise",
  digitizing: "Digitising",
  ready: "Ready to stitch",
  stitched: "Stitched",
};

/** What the operator does next, as a verb — the primary button on each card. */
const NEXT_ACTION: Record<Status, { next: Status; label: string } | null> = {
  pending: { next: "digitizing", label: "Start digitising" },
  digitizing: { next: "ready", label: "Mark ready" },
  ready: { next: "stitched", label: "Mark stitched" },
  stitched: null,
};

interface ThreadColor {
  brand: string;
  code: string;
  name: string;
  hex: string;
}

interface QueueRow {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  orderedAt: string;
  customerName: string | null;
  productTitle: string;
  sku: string | null;
  quantity: number;
  placementLabel: string;
  contentType: "text" | "monogram";
  text: string;
  fontName: string;
  heightMm: number;
  threadColors: ThreadColor[];
  stitchEstimate: number;
  priceCents: number;
  productionStatus: Status;
  productionNote: string | null;
  stitchFileKey: string | null;
  digitizedAt: string | null;
}

interface QueueResponse {
  total: number;
  counts: Record<Status, number>;
  items: QueueRow[];
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

/**
 * The embroidery production queue.
 *
 * Built for someone standing at a machine, not sitting at a desk: the text to
 * be stitched is the largest thing on every card, the thread codes are the
 * supplier's own so they can be read straight onto a spool, and one button
 * moves a job to its next state. Everything shown was frozen when the order
 * was placed — nothing re-reads the live catalogue, because a thread retired
 * last week must not change a job already on the floor.
 */
export default function PersonalizationQueuePage() {
  const [status, setStatus] = useState<Status | "all">("pending");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [artwork, setArtwork] = useState<{ id: string; svg: string } | null>(null);

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

  const advance = useCallback(
    async (row: QueueRow) => {
      const action = NEXT_ACTION[row.productionStatus];
      if (!action) return;
      setBusyId(row.id);
      try {
        await api.patch(`/next-api/admin/shop/personalization/queue/${row.id}`, { productionStatus: action.next });
        await load();
      } catch {
        setError("Could not update that job.");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const openArtwork = useCallback(async (row: QueueRow) => {
    try {
      const res = await api.get<{ productionSvg: string | null }>(
        `/next-api/admin/shop/personalization/queue/${row.id}/artwork`,
      );
      setArtwork({ id: row.id, svg: res.productionSvg ?? "" });
    } catch {
      setError("Could not load the artwork for that job.");
    }
  }, []);

  /**
   * Opens the vector artwork in its own window to print. It is already sized
   * in millimetres, so "actual size" on any printer produces a placement
   * template the operator can hold against the cap.
   */
  const printArtwork = useCallback((svg: string) => {
    const w = window.open("", "_blank", "width=760,height=560");
    if (!w) return;
    w.document.write(`<!doctype html><title>Embroidery artwork</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}svg{max-width:96vw}</style>${svg}`);
    w.document.close();
    w.focus();
    w.print();
  }, []);

  const totalStitches = useMemo(
    () => (data?.items ?? []).reduce((sum, r) => sum + r.stitchEstimate * r.quantity, 0),
    [data],
  );

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.pageTitle}>Embroidery production</h1>
          <p className={ui.pageHint}>
            Every personalised line that has been ordered, in the order it was placed. The text shown is exactly what
            gets stitched.
          </p>
        </div>
      </div>

      <div className={ui.kpiStrip}>
        {STATUSES.map((s) => (
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
          {(["all", ...STATUSES] as const).map((s) => (
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
            placeholder="Order number, product or embroidered text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <p className={ui.error}>{error}</p>}

      {loading && !data ? (
        <p className={ui.muted}>Loading…</p>
      ) : !data?.items.length ? (
        <div className={ui.emptyState}>
          <Scissors size={22} aria-hidden="true" />
          <p>Nothing in this queue.</p>
        </div>
      ) : (
        <div className={styles.jobGrid}>
          {data.items.map((row) => {
            const action = NEXT_ACTION[row.productionStatus];
            return (
              <article key={row.id} className={styles.job}>
                <header className={styles.jobHead}>
                  <div>
                    <a className={styles.orderLink} href={`/admin/shop/orders/${row.orderId}`}>
                      {row.orderNumber}
                    </a>
                    <span className={styles.jobDate}>{new Date(row.orderedAt).toLocaleDateString()}</span>
                  </div>
                  <span className={`${styles.statusBadge} ${styles[`status_${row.productionStatus}`]}`}>
                    {STATUS_LABEL[row.productionStatus]}
                  </span>
                </header>

                {/* The whole reason the operator is on this screen. Set large
                    and unstyled by any font of ours — the face is named below
                    rather than imitated, so nobody mistakes the preview for
                    the stitch file. */}
                <div className={styles.stitchText}>
                  <span className={styles.stitchTextLabel}>
                    {row.contentType === "monogram" ? "Monogram" : "Text"}
                  </span>
                  <strong className={styles.stitchTextValue}>{row.text}</strong>
                </div>

                <dl className={styles.jobSpecs}>
                  <div>
                    <dt>Item</dt>
                    <dd>
                      {row.quantity} × {row.productTitle}
                      {row.sku && <span className={ui.codeChip}>{row.sku}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Position</dt>
                    <dd>{row.placementLabel}</dd>
                  </div>
                  <div>
                    <dt>Font / height</dt>
                    <dd>
                      {row.fontName} · {row.heightMm} mm
                    </dd>
                  </div>
                  <div>
                    <dt>Thread</dt>
                    <dd className={styles.threads}>
                      {row.threadColors.map((th, i) => (
                        <span key={`${th.code}-${i}`} className={styles.thread}>
                          <span className={styles.threadChip} style={{ background: th.hex }} aria-hidden="true" />
                          <span className={styles.threadCode}>
                            {th.brand} {th.code}
                          </span>
                          <span className={styles.threadName}>{th.name}</span>
                        </span>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt>Stitches</dt>
                    <dd>
                      ≈ {(row.stitchEstimate * row.quantity).toLocaleString()}
                      {row.quantity > 1 && <span className={ui.muted}> ({row.stitchEstimate.toLocaleString()} each)</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Charged</dt>
                    <dd>{eur(row.priceCents * row.quantity)}</dd>
                  </div>
                </dl>

                <footer className={styles.jobActions}>
                  <button type="button" className={styles.secondaryBtn} onClick={() => openArtwork(row)}>
                    <FileDown size={14} aria-hidden="true" /> Artwork
                  </button>
                  {action && (
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => advance(row)}
                      disabled={busyId === row.id}
                    >
                      {busyId === row.id ? (
                        <Loader2 size={14} className={styles.spin} aria-hidden="true" />
                      ) : (
                        <Check size={14} aria-hidden="true" />
                      )}
                      {action.label}
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {artwork && (
        <div className={styles.artworkOverlay} role="dialog" aria-modal="true" onClick={() => setArtwork(null)}>
          <div className={styles.artworkPanel} onClick={(e) => e.stopPropagation()}>
            <header className={styles.artworkHead}>
              <h2>Production artwork</h2>
              <div className={styles.artworkActions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => printArtwork(artwork.svg)} disabled={!artwork.svg}>
                  <Printer size={14} aria-hidden="true" /> Print actual size
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={() => setArtwork(null)}>
                  Close
                </button>
              </div>
            </header>
            {artwork.svg ? (
              // The SVG is generated server-side from the stored design and
              // never from anything a customer typed into the page, so it is
              // safe to inline — and inlining is what lets it print to scale.
              <div className={styles.artworkStage} dangerouslySetInnerHTML={{ __html: artwork.svg }} />
            ) : (
              <p className={ui.muted}>
                No artwork was stored for this job. It can be rebuilt from the saved design — the order still holds
                everything needed.
              </p>
            )}
            <p className={styles.artworkNote}>
              The dashed rectangle is the hoop field for this position, drawn at true size in millimetres.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
