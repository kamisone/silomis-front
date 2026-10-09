"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import styles from "./notifications.module.css";

interface Settings {
  smsEnabled: boolean;
  smsPhones: string[];
  emailEnabled: boolean;
  emailAddresses: string[];
  events: string[];
  /** Texts to customers about their own order — every order with a phone. */
  customerSmsEnabled: boolean;
  /** A customer who gives no email confirms their phone with a texted code. */
  checkoutPhoneVerification: boolean;
}

interface LogEntry {
  id: string;
  event: string;
  channel: "sms" | "email";
  recipient: string;
  status: "sent" | "failed" | "skipped";
  orderId: string | null;
  orderNumber: string | null;
  error: string | null;
  createdAt: string;
}

const EVENT_OPTIONS: { key: string; label: string; desc: string }[] = [
  { key: "payment_succeeded", label: "New Order (Payment Confirmed)", desc: "When a customer completes payment" },
  { key: "payment_failed", label: "Payment Failed", desc: "When a payment attempt fails" },
  { key: "order_cancelled", label: "Order Cancelled", desc: "When an order is cancelled" },
  { key: "order_shipped", label: "Order Shipped", desc: "When an order is marked as shipped" },
  { key: "order_delivered", label: "Order Delivered", desc: "When an order is marked as delivered" },
  { key: "low_stock", label: "Low Stock Alert", desc: "When product inventory runs low" },
  { key: "support_message", label: "Support Message", desc: "When a visitor writes in the storefront support chat" },
  { key: "order_message", label: "Order Message", desc: "When a customer writes on one of their orders" },
];

/**
 * What customers are texted about their own order (CustomerSmsService). Not
 * selectable one by one — one switch covers them — but they share the log,
 * so they need names there.
 */
const CUSTOMER_SMS_EVENTS: { key: string; label: string }[] = [
  { key: "customer_order_confirmed", label: "Customer: order confirmed" },
  { key: "customer_payment_failed", label: "Customer: payment failed" },
  { key: "customer_order_shipped", label: "Customer: order shipped" },
  { key: "customer_order_cancelled", label: "Customer: order cancelled" },
  { key: "customer_send_in_received", label: "Customer: send-in item received" },
  { key: "customer_send_in_returned", label: "Customer: send-in item returned" },
  { key: "customer_send_in_problem", label: "Customer: send-in needs them" },
  { key: "customer_order_message", label: "Customer: shop replied" },
  { key: "customer_access_link", label: "Customer: tracking link" },
  { key: "customer_cart_abandoned", label: "Customer: abandoned-cart reminder" },
  { key: "customer_phone_code", label: "Customer: checkout verification code" },
  { key: "customer_sms_opt_out", label: "Customer: replied STOP" },
];

const EVENT_LABELS: Record<string, string> = Object.fromEntries([...EVENT_OPTIONS, ...CUSTOMER_SMS_EVENTS].map((e) => [e.key, e.label]));

interface SupportSettings {
  /** One conversation pages at most this often, however chatty the guest is. */
  smsCooldownMin: number;
  inactiveCloseHours: number;
}

const LOGS_PAGE_SIZE = 30;

type Tab = "settings" | "logs";

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<Tab>("settings");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [support, setSupport] = useState<SupportSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [phoneDraft, setPhoneDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logFilter, setLogFilter] = useState({ channel: "", event: "", status: "" });
  const [logsLoading, setLogsLoading] = useState(true);

  const logsUrl = useCallback(
    (offset: number) => {
      const qs = new URLSearchParams();
      if (logFilter.channel) qs.set("channel", logFilter.channel);
      if (logFilter.event) qs.set("event", logFilter.event);
      if (logFilter.status) qs.set("status", logFilter.status);
      qs.set("limit", String(LOGS_PAGE_SIZE));
      qs.set("offset", String(offset));
      return `/next-api/admin/shop/notifications/logs?${qs}`;
    },
    [logFilter],
  );

  useEffect(() => {
    // Both cards render independently, so a failure on one leaves the other
    // usable rather than taking the page down with an unhandled rejection.
    api.get<Settings>("/next-api/admin/shop/notifications/settings").then(setSettings).catch(() => {});
    api.get<SupportSettings>("/next-api/support/admin/settings").then(setSupport).catch(() => {});
  }, []);

  // Re-fetches the first page whenever a filter changes. The spinner is turned
  // on by the filter's own change handler rather than here: setting state
  // synchronously inside an effect body trips react-hooks/set-state-in-effect
  // and causes a cascading render.
  useEffect(() => {
    let active = true;
    api
      .get<{ logs: LogEntry[]; total: number }>(logsUrl(0))
      .then((data) => {
        if (!active) return;
        setLogs(data.logs);
        setLogsTotal(data.total);
      })
      .finally(() => {
        if (active) setLogsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [logsUrl]);

  /** Filter changes go through here so the spinner shows before the refetch. */
  function changeFilter(p: Partial<typeof logFilter>) {
    setLogsLoading(true);
    setLogFilter((f) => ({ ...f, ...p }));
  }

  async function loadMore() {
    setLogsLoading(true);
    try {
      const data = await api.get<{ logs: LogEntry[]; total: number }>(logsUrl(logs.length));
      setLogs((prev) => [...prev, ...data.logs]);
      setLogsTotal(data.total);
    } finally {
      setLogsLoading(false);
    }
  }

  const patch = (p: Partial<Settings>) => {
    setSettings((s) => (s ? { ...s, ...p } : s));
    markDirty();
  };

  const patchSupport = (p: Partial<SupportSettings>) => {
    setSupport((s) => (s ? { ...s, ...p } : s));
    markDirty();
  };

  function markDirty() {
    setDirty(true);
    setSaved(false);
    setSaveError(null);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setSaveError(null);
    try {
      setSettings(await api.patch<Settings>("/next-api/admin/shop/notifications/settings", settings));
      if (support) {
        setSupport(await api.patch<SupportSettings>("/next-api/support/admin/settings", { smsCooldownMin: support.smsCooldownMin }));
      }
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addPhone() {
    const p = phoneDraft.trim();
    if (!p || !settings || settings.smsPhones.includes(p)) return;
    patch({ smsPhones: [...settings.smsPhones, p] });
    setPhoneDraft("");
  }

  function addEmail() {
    const e = emailDraft.trim().toLowerCase();
    if (!e || !settings || settings.emailAddresses.includes(e)) return;
    patch({ emailAddresses: [...settings.emailAddresses, e] });
    setEmailDraft("");
  }

  function toggleEvent(key: string) {
    if (!settings) return;
    patch({ events: settings.events.includes(key) ? settings.events.filter((e) => e !== key) : [...settings.events, key] });
  }

  if (!settings) {
    return (
      <div className={styles.page}>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Notifications</h1>
          <p className={styles.subtitle}>Configure SMS and email alerts for order events</p>
        </div>
      </div>

      <div className={styles.tabRow}>
        <button className={`${styles.tab} ${tab === "settings" ? styles.tabActive : ""}`} onClick={() => setTab("settings")}>
          Settings
        </button>
        <button className={`${styles.tab} ${tab === "logs" ? styles.tabActive : ""}`} onClick={() => setTab("logs")}>
          Notification Log
        </button>
      </div>

      {tab === "settings" && (
        <>
          <div className={styles.grid}>
            {/* ── SMS ── */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>SMS Notifications</h2>
                <button
                  type="button"
                  className={`${styles.toggle} ${settings.smsEnabled ? styles.toggleOn : ""}`}
                  onClick={() => patch({ smsEnabled: !settings.smsEnabled })}
                  aria-label="Toggle SMS"
                  aria-pressed={settings.smsEnabled}
                />
              </div>
              <div className={styles.cardBody}>
                <div>
                  <p className={styles.toggleLabel}>Phone numbers</p>
                  <div className={styles.chipList}>
                    {settings.smsPhones.map((p) => (
                      <span key={p} className={styles.chip}>
                        {p}
                        <button
                          type="button"
                          className={styles.chipRemove}
                          aria-label={`Remove ${p}`}
                          onClick={() => patch({ smsPhones: settings.smsPhones.filter((x) => x !== p) })}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className={styles.addRow}>
                  <input
                    className={styles.addInput}
                    placeholder="+33 6 12 34 56 78"
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPhone();
                      }
                    }}
                  />
                  <button type="button" className={styles.addBtn} onClick={addPhone} disabled={!phoneDraft.trim()}>
                    Add
                  </button>
                </div>
                <p className={styles.cardNote}>Leave empty to text every admin account that has a phone number on file.</p>
              </div>
            </div>

            {/* ── Email ── */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Email Notifications</h2>
                <button
                  type="button"
                  className={`${styles.toggle} ${settings.emailEnabled ? styles.toggleOn : ""}`}
                  onClick={() => patch({ emailEnabled: !settings.emailEnabled })}
                  aria-label="Toggle Email"
                  aria-pressed={settings.emailEnabled}
                />
              </div>
              <div className={styles.cardBody}>
                <div>
                  <p className={styles.toggleLabel}>Email addresses</p>
                  <div className={styles.chipList}>
                    {settings.emailAddresses.map((e) => (
                      <span key={e} className={styles.chip}>
                        {e}
                        <button
                          type="button"
                          className={styles.chipRemove}
                          aria-label={`Remove ${e}`}
                          onClick={() => patch({ emailAddresses: settings.emailAddresses.filter((x) => x !== e) })}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className={styles.addRow}>
                  <input
                    className={styles.addInput}
                    type="email"
                    placeholder="admin@example.com"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addEmail();
                      }
                    }}
                  />
                  <button type="button" className={styles.addBtn} onClick={addEmail} disabled={!emailDraft.trim()}>
                    Add
                  </button>
                </div>
                <p className={styles.cardNote}>Leave empty to email every admin account.</p>
              </div>
            </div>
          </div>

          {/* ── Events ── */}
          <div className={styles.card} style={{ marginTop: 24 }}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Notification Events</h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.eventList}>
                {EVENT_OPTIONS.map((ev) => {
                  const on = settings.events.includes(ev.key);
                  return (
                    // The whole row is the control, so the label and the
                    // description are as clickable as the switch itself.
                    <button
                      key={ev.key}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      className={`${styles.eventRow} ${on ? styles.eventRowOn : ""}`}
                      onClick={() => toggleEvent(ev.key)}
                    >
                      <span className={styles.eventText}>
                        <span className={styles.eventLabel}>{ev.label}</span>
                        <span className={styles.eventDesc}>{ev.desc}</span>
                      </span>
                      <span className={`${styles.toggle} ${on ? styles.toggleOn : ""}`} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Customer SMS ── */}
          <div className={styles.card} style={{ marginTop: 24 }}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>SMS to customers</h2>
              <button
                type="button"
                className={`${styles.toggle} ${settings.customerSmsEnabled ? styles.toggleOn : ""}`}
                onClick={() => patch({ customerSmsEnabled: !settings.customerSmsEnabled })}
                aria-label="Toggle SMS to customers"
                aria-pressed={settings.customerSmsEnabled}
              />
            </div>
            <div className={styles.cardBody}>
              <p className={styles.cardNote} style={{ marginTop: 0 }}>
                Every order with a phone number gets a text at the moments that matter: order confirmed, payment
                failed, shipped, cancelled, a send-in item received / sent back / needing the customer, and the shop
                replying on the order. Each text carries the order&rsquo;s tracking link. For a customer who checked
                out with a phone only, this is the only news they get. Sent through the same SMS gateway as the alerts
                above; every text appears in the log as &ldquo;Customer: …&rdquo;.
              </p>
              <p className={styles.cardNote}>
                <strong>Abandoned-cart reminder:</strong> only to customers who ticked &ldquo;Send me reminders by
                SMS&rdquo; at checkout, one hour after their last change to the basket. It tells them to
                reply STOP; a number that does is never sent another marketing text (order updates still go out).
              </p>
              <label className={styles.numberRow}>
                <span className={styles.eventText}>
                  <span className={styles.eventLabel}>Verify the phone of customers without an email</span>
                  <span className={styles.eventDesc}>
                    Before the order is created, a customer who gave only a phone number types back a 6-digit code
                    texted to it. Catches wrong numbers, at the cost of a wait for the gateway phone to send the
                    code. The customer can always enter an email instead.
                  </span>
                </span>
                <button
                  type="button"
                  className={`${styles.toggle} ${settings.checkoutPhoneVerification ? styles.toggleOn : ""}`}
                  onClick={() => patch({ checkoutPhoneVerification: !settings.checkoutPhoneVerification })}
                  aria-label="Toggle phone verification at checkout"
                  aria-pressed={settings.checkoutPhoneVerification}
                />
              </label>
            </div>
          </div>

          {/* ── Support behaviour ── */}
          {support && (
            <div className={styles.card} style={{ marginTop: 24 }}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Support Chat</h2>
              </div>
              <div className={styles.cardBody}>
                <label className={styles.numberRow}>
                  <span className={styles.eventText}>
                    <span className={styles.eventLabel}>Cooldown between alerts</span>
                    <span className={styles.eventDesc}>
                      Minutes before the same conversation may alert again, so a customer sending six
                      messages in a row does not send six texts.
                    </span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    className={styles.numberInput}
                    value={support.smsCooldownMin}
                    onChange={(e) => patchSupport({ smsCooldownMin: Number(e.target.value) })}
                  />
                </label>
                <p className={styles.cardNote}>
                  Turn the alerts themselves on or off with <strong>Support Message</strong> above. Auto-closing
                  idle conversations is set in the Support panel.
                </p>
              </div>
            </div>
          )}

          {/* ── Save ── */}
          <div className={styles.saveBar}>
            {saveError && <span className={styles.saveError}>{saveError}</span>}
            {saved && <span className={styles.saved}>Settings saved</span>}
            <button type="button" className={styles.saveBtn} onClick={save} disabled={!dirty || saving}>
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </>
      )}

      {/* ── Logs ── */}
      {tab === "logs" && (
        <div className={styles.logsSection}>
          <div className={styles.logsHeader}>
            <h2 className={styles.logsTitle}>Notification Log</h2>
            <div className={styles.logsFilters}>
              <select
                className={styles.filterSelect}
                value={logFilter.channel}
                onChange={(e) => changeFilter({ channel: e.target.value })}
              >
                <option value="">All channels</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
              <select
                className={styles.filterSelect}
                value={logFilter.event}
                onChange={(e) => changeFilter({ event: e.target.value })}
              >
                <option value="">All events</option>
                {[...EVENT_OPTIONS, ...CUSTOMER_SMS_EVENTS].map((ev) => (
                  <option key={ev.key} value={ev.key}>
                    {ev.label}
                  </option>
                ))}
              </select>
              <select
                className={styles.filterSelect}
                value={logFilter.status}
                onChange={(e) => changeFilter({ status: e.target.value })}
              >
                <option value="">All statuses</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
          </div>

          {logs.length === 0 && !logsLoading ? (
            <div className={styles.emptyLogs}>No notifications sent yet</div>
          ) : (
            <>
              <div className={styles.logsTableWrap}>
                <table className={styles.logsTable}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Channel</th>
                      <th>Event</th>
                      <th>Recipient</th>
                      <th>Order</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>{new Date(log.createdAt).toLocaleString()}</td>
                        <td>
                          <span className={log.channel === "sms" ? styles.channelSms : styles.channelEmail}>{log.channel.toUpperCase()}</span>
                        </td>
                        <td>{EVENT_LABELS[log.event] ?? log.event}</td>
                        <td>{log.recipient}</td>
                        <td>{log.orderNumber ? `#${log.orderNumber}` : "—"}</td>
                        <td>
                          <span
                            className={
                              log.status === "sent" ? styles.statusSent : log.status === "failed" ? styles.statusFailed : styles.statusSkipped
                            }
                          >
                            {log.status}
                          </span>
                          {log.error && <div className={styles.logError}>{log.error}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {logs.length < logsTotal && (
                <button type="button" className={styles.loadMore} onClick={loadMore} disabled={logsLoading}>
                  {logsLoading ? "Loading…" : `Load more (${logsTotal - logs.length} remaining)`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
