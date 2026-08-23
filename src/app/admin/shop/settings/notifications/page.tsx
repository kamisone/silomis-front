"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

type AdminNotifEvent = "payment_succeeded" | "payment_failed" | "order_cancelled";

const EVENT_LABELS: Record<AdminNotifEvent, string> = {
  payment_succeeded: "Payment received",
  payment_failed: "Payment failed",
  order_cancelled: "Order cancelled",
};

interface NotificationLog {
  id: string;
  event: string;
  channel: string;
  recipient: string;
  status: string;
  orderNumber: string | null;
  error: string | null;
  createdAt: string;
}

export default function NotificationSettingsPage() {
  const [tab, setTab] = useState<"settings" | "log">("settings");
  const [events, setEvents] = useState<AdminNotifEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    api
      .get<{ events: AdminNotifEvent[] }>("/next-api/admin/shop/notifications/settings")
      .then((r) => setEvents(r.events))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== "log") return;
    setLogsLoading(true);
    api
      .get<{ items: NotificationLog[] }>("/next-api/admin/shop/notifications/logs?limit=50")
      .then((r) => setLogs(r.items))
      .finally(() => setLogsLoading(false));
  }, [tab]);

  function toggleEvent(event: AdminNotifEvent) {
    setEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.put("/next-api/admin/shop/notifications/settings", { events });
      setSaved(true);
    } catch (err) {
      alert(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Admin notifications</h1>
      </div>

      <div className={ui.toolbar}>
        <Button variant={tab === "settings" ? "primary" : "secondary"} onClick={() => setTab("settings")}>
          Settings
        </Button>
        <Button variant={tab === "log" ? "primary" : "secondary"} onClick={() => setTab("log")}>
          Notification log
        </Button>
      </div>

      {tab === "settings" ? (
        <div className={ui.card}>
          {loading ? (
            <div className={ui.emptyState}>Loading…</div>
          ) : (
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 420 }}>
              <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)" }}>
                Every admin (email + SMS, when a phone is on file) is notified for each enabled event below.
              </p>
              {(Object.keys(EVENT_LABELS) as AdminNotifEvent[]).map((event) => (
                <label key={event} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                  <input type="checkbox" checked={events.includes(event)} onChange={() => toggleEvent(event)} />
                  {EVENT_LABELS[event]}
                </label>
              ))}
              <div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                {saved && <span style={{ marginLeft: "0.75rem", fontSize: "0.85rem", color: "var(--color-secondary)" }}>Saved</span>}
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className={ui.card}>
          {logsLoading ? (
            <div className={ui.emptyState}>Loading…</div>
          ) : logs.length === 0 ? (
            <div className={ui.emptyState}>No notifications sent yet.</div>
          ) : (
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event</th>
                  <th>Channel</th>
                  <th>Recipient</th>
                  <th>Order</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.createdAt).toLocaleString()}</td>
                    <td>{EVENT_LABELS[l.event as AdminNotifEvent] ?? l.event}</td>
                    <td>{l.channel}</td>
                    <td>{l.recipient}</td>
                    <td>{l.orderNumber ?? "—"}</td>
                    <td>
                      <span className={l.status === "sent" ? ui.badgeActive : l.status === "failed" ? ui.badgeInactive : ui.badge}>{l.status}</span>
                      {l.error && <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>{l.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
