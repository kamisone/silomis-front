"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
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
  type: "click" | "scroll" | "navigation";
  timestampMs: number;
  label: string | null;
}

const MARKER_COLOR: Record<Marker["type"], string> = { click: "#2563eb", scroll: "#f59e0b", navigation: "#16a34a" };

interface Props {
  onClose: () => void;
  /** Scopes the session list to one product — used from the test-products demand table. */
  productId?: string;
  productTitle?: string;
}

export default function SessionReplayModal({ onClose, productId, productTitle }: Props) {
  const [sessions, setSessions] = useState<ReplaySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReplaySession | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [events, setEvents] = useState<unknown[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);

  useEffect(() => {
    const qs = new URLSearchParams({ limit: "50" });
    if (productId) qs.set("productId", productId);
    api
      .get<{ items: ReplaySession[]; total: number }>(`/next-api/admin/shop/replay/sessions?${qs.toString()}`)
      .then((r) => setSessions(r.items))
      .finally(() => setLoading(false));
  }, [productId]);

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
              <p>No recorded sessions yet — recordings only happen on test-product pages.</p>
            ) : (
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
                        <Button variant="secondary" onClick={() => openSession(s)}>
                          {s.viewedAt ? "Watch again" : "Watch"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    return <span key={m.id} className={styles.timelineDot} style={{ left: `${pct}%`, background: MARKER_COLOR[m.type] }} title={`${m.type}${m.label ? `: ${m.label}` : ""}`} />;
                  })}
                </div>
                <ul className={styles.eventList}>
                  {markers.map((m) => (
                    <li key={m.id} className={Math.abs(m.timestampMs - currentMs) < 500 ? styles.eventActive : ""}>
                      <span style={{ color: MARKER_COLOR[m.type] }}>●</span> {m.type}
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
