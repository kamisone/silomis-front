"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Check, CheckCheck, Play, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import styles from "./SessionReplay.module.css";

const ReplayPlayer = dynamic(() => import("./ReplayPlayer"), { ssr: false });

type SessionStatus = "active" | "ended" | "error";

interface ReplaySession {
  id: string;
  productId: string | null;
  countryCode: string | null;
  device: string | null;
  source: string | null;
  eventCount: number;
  clickCount: number;
  maxScrollPct: number;
  status: SessionStatus;
  startedAt: string;
  durationMs: number | null;
  viewedAt: string | null;
  product: { id: string; title: string } | null;
}

interface Marker {
  id: string;
  type: "session_start" | "session_end" | "click" | "scroll" | "navigation";
  timestampMs: number;
  label: string | null;
}

const MARKER_COLOR: Record<Marker["type"], string> = {
  session_start: "#64748b",
  session_end: "#64748b",
  click: "#2563eb",
  scroll: "#f59e0b",
  navigation: "#16a34a",
};

const MARKER_LABEL: Record<Marker["type"], string> = {
  session_start: "Session started",
  session_end: "Session ended",
  click: "Click",
  scroll: "Scroll",
  navigation: "Navigation",
};

interface Props {
  onClose: () => void;
  /** Scopes the session list to one product — used from the test-products demand table. */
  productId?: string;
  productTitle?: string;
  /**
   * The caller's date-window query params (`days`, or `startDate`/`endDate`),
   * forwarded verbatim. The list must use the same window as the unread badge
   * that opened it, otherwise the badge count and the list disagree.
   */
  windowParams?: Record<string, string>;
}

export default function SessionReplayModal({ onClose, productId, productTitle, windowParams }: Props) {
  const [sessions, setSessions] = useState<ReplaySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReplaySession | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [events, setEvents] = useState<unknown[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);

  // windowParams is a fresh object literal on every parent render, so it is
  // compared by value here rather than by identity — otherwise the list refetches
  // on each keystroke in the table's filters.
  const windowKey = JSON.stringify(windowParams ?? {});

  useEffect(() => {
    const qs = new URLSearchParams({ ...(JSON.parse(windowKey) as Record<string, string>), limit: "50" });
    if (productId) qs.set("productId", productId);
    api
      .get<{ items: ReplaySession[]; total: number }>(`/next-api/admin/shop/replay/sessions?${qs.toString()}`)
      .then((r) => setSessions(r.items))
      .finally(() => setLoading(false));
  }, [productId, windowKey]);

  const [markingId, setMarkingId] = useState<string | null>(null);

  /**
   * Clears one session's unread badge without loading its recording. Most of a
   * long list is identifiable as uninteresting from the row alone — a
   * two-second bounce with no clicks — and playing each one back to dismiss it
   * is the slow way to do that.
   */
  const markViewed = useCallback(async (session: ReplaySession) => {
    if (session.viewedAt) return;
    setMarkingId(session.id);
    try {
      const { viewedAt } = await api.patch<{ viewedAt: string }>(`/next-api/admin/shop/replay/sessions/${session.id}/viewed`, {});
      // Patched in place rather than refetching the list: a refetch would
      // reset the scroll position, which is the one thing someone working
      // down a long list cannot afford to lose.
      setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, viewedAt } : s)));
    } catch {
      // Leaving the row unread is the honest outcome of a failed write.
    } finally {
      setMarkingId(null);
    }
  }, []);

  async function openSession(session: ReplaySession) {
    setSelected(session);
    setLoadingDetail(true);
    setCurrentMs(0);
    try {
      const [detail, sessionEvents] = await Promise.all([
        api.get<{ session: ReplaySession; markers: Marker[] }>(`/next-api/admin/shop/replay/sessions/${session.id}`),
        api.get<unknown[]>(`/next-api/admin/shop/replay/sessions/${session.id}/events`),
      ]);
      setMarkers(detail.markers);
      setEvents(sessionEvents);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>{selected ? (selected.product?.title ?? "Session replay") : (productTitle ? `Session replays — ${productTitle}` : "Session replays (test products)")}</span>
          <div>
            {selected && (
              <Button variant="secondary" onClick={() => setSelected(null)}>
                ← Back to list
              </Button>
            )}
            <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {!selected ? (
            loading ? (
              <p>Loading…</p>
            ) : sessions.length === 0 ? (
              <p>No recorded sessions in this window. Recording needs the visitor to have accepted analytics cookies, and live-product sessions are sampled (see REPLAY_LIVE_SAMPLE_RATE).</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Device</th>
                      <th>Country</th>
                      <th>Source</th>
                      <th>Clicks</th>
                      <th>Max scroll</th>
                      <th>Status</th>
                      <th>Started</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td>{s.product?.title ?? s.productId ?? "—"}</td>
                        <td>{s.device ?? "—"}</td>
                        <td>{s.countryCode ?? "—"}</td>
                        <td>{s.source ?? "—"}</td>
                        <td>{s.clickCount}</td>
                        <td>{s.maxScrollPct}%</td>
                        <td>{s.status}</td>
                        <td>{new Date(s.startedAt).toLocaleString()}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => openSession(s)}
                              // Icon-only, so the label lives in the tooltip
                              // and the accessible name — both still say which
                              // of the two states this is.
                              title={s.viewedAt ? "Watch again" : "Watch"}
                              aria-label={s.viewedAt ? "Watch again" : "Watch"}
                            >
                              {s.viewedAt ? <RotateCcw size={15} strokeWidth={2.2} /> : <Play size={15} strokeWidth={2.2} />}
                            </button>

                            {s.viewedAt ? (
                              // Not a button: there is nothing left to do to a
                              // session that has been seen, and a control that
                              // looks live but does nothing is worse than a
                              // state indicator.
                              <span className={`${styles.iconBtn} ${styles.iconRead}`} title="Already viewed" aria-label="Already viewed">
                                <CheckCheck size={15} strokeWidth={2.2} />
                              </span>
                            ) : (
                              <button
                                type="button"
                                className={styles.iconBtn}
                                onClick={() => markViewed(s)}
                                disabled={markingId === s.id}
                                title="Mark as viewed"
                                aria-label="Mark as viewed"
                              >
                                <Check size={15} strokeWidth={2.4} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : loadingDetail ? (
            <p>Loading recording…</p>
          ) : events.length === 0 ? (
            <p>No recorded frames for this session.</p>
          ) : (
            <div className={styles.detailLayout}>
              <div className={styles.playerCol}>
                <ReplayPlayer events={events} onTimeUpdate={setCurrentMs} />
              </div>
              <div className={styles.timelineCol}>
                <div className={styles.timelineTrack}>
                  {markers.map((m) => {
                    const pct = selected.durationMs ? Math.min(100, (m.timestampMs / selected.durationMs) * 100) : 0;
                    return <span key={m.id} className={styles.timelineDot} style={{ left: `${pct}%`, background: MARKER_COLOR[m.type] }} title={`${MARKER_LABEL[m.type] ?? m.type}${m.label ? `: ${m.label}` : ""}`} />;
                  })}
                </div>
                <ul className={styles.eventList}>
                  {markers.map((m) => (
                    <li key={m.id} className={Math.abs(m.timestampMs - currentMs) < 500 ? styles.eventActive : ""}>
                      <span style={{ color: MARKER_COLOR[m.type] }}>●</span> {MARKER_LABEL[m.type] ?? m.type}
                      {m.label ? ` — ${m.label}` : ""}
                      <span className={styles.eventTime}>{(m.timestampMs / 1000).toFixed(1)}s</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
