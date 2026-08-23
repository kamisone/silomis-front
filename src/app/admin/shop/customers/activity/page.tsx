"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface EventLog {
  id: string;
  eventName: string;
  entityId: string | null;
  source: string | null;
  status: "success" | "failed";
  createdAt: string;
}

const LIMIT = 50;

export default function CustomerActivityPage() {
  const [items, setItems] = useState<EventLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ items: EventLog[]; total: number }>(`/next-api/admin/shop/customers/activity?limit=${LIMIT}&offset=${offset}`);
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Customer Activity {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No activity recorded yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Event</th>
                <th>Entity</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleString()}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{e.eventName}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--color-secondary)" }}>{e.entityId?.slice(0, 8) ?? "—"}</td>
                  <td style={{ color: "var(--color-secondary)" }}>{e.source ?? "—"}</td>
                  <td>
                    <span className={e.status === "success" ? ui.badgeActive : ui.badgeInactive}>{e.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && total > LIMIT && (
        <div className={ui.toolbar}>
          <Button variant="secondary" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}>
            Previous
          </Button>
          <span style={{ fontSize: "0.85rem", color: "var(--color-secondary)" }}>
            {Math.floor(offset / LIMIT) + 1} / {pages}
          </span>
          <Button variant="secondary" disabled={offset + LIMIT >= total} onClick={() => setOffset((o) => o + LIMIT)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
