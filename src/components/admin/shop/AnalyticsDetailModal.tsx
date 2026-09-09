"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useToast } from "@/components/toast/ToastContext";
import styles from "./AnalyticsDetailModal.module.css";

interface EventDetailRow {
  id: string;
  eventType: string;
  createdAt: string;
  productTitle: string | null;
  countryName: string | null;
  countryCode: string | null;
  cartToken: string | null;
  quantity: number | null;
  /** Null for rows recorded before this was captured. */
  clientIp: string | null;
  /** 'mobile' | 'desktop', null when no User-Agent was available to classify. */
  device: string | null;
  /** First-touch acquisition channel, null when not captured for this event type. */
  source: string | null;
}

/** Full set of behaviour event types, for the in-modal event-name filter. */
export const EVENT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "product_view", label: "Product view" },
  { value: "add_to_cart", label: "Added to cart" },
  // Same wording as the funnel steps and the table columns: these are two
  // different steps, and calling one by its raw event name made them read as
  // duplicates of each other.
  { value: "checkout_started", label: "Reached shipping" },
  { value: "test_checkout_blocked", label: "Reached checkout (test)" },
  { value: "update_cart_item", label: "Cart updated" },
  { value: "remove_from_cart", label: "Removed from cart" },
  { value: "search", label: "Search" },
];

/** The event types a test-product row drills into. */
export const TEST_EVENT_TYPES = "product_view,add_to_cart,checkout_started,test_checkout_blocked";

export function eventTypeLabel(value: string): string {
  return EVENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

const DEVICE_OPTIONS = [
  { value: "mobile", label: "Mobile" },
  { value: "desktop", label: "Desktop" },
];

/** Scope params the modal owns its own controls for, rather than passing through. */
const OWNED_KEYS = ["eventType", "countryCode", "device", "source"];

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * The drill-down behind a clicked analytics row: every event in that row's
 * scope, one line each, with the country, device, source and IP behind the
 * number.
 *
 * The caller passes the scope it was clicked in (product, date window); the
 * modal owns the filters that narrow it further, seeded from that scope.
 */
export default function AnalyticsDetailModal({
  open,
  onClose,
  title,
  subtitle,
  params,
  eventOptions = EVENT_TYPE_OPTIONS,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  params: Record<string, string>;
  eventOptions?: Array<{ value: string; label: string }>;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EventDetailRow[]>([]);
  const [blockedIps, setBlockedIps] = useState<Set<string>>(new Set());
  const [blockingIp, setBlockingIp] = useState<string | null>(null);

  // Seeded lazily from `params` so the first render — and therefore the first
  // fetch — already uses the clicked scope. Callers render this behind
  // `{modal && <AnalyticsDetailModal …/>}`, so every open is a fresh mount.
  // Without the lazy seed a request would fire with the defaults, a second
  // with the seeded scope, and the slower of the two would win.
  const [eventType, setEventType] = useState(() => (params.eventType && !params.eventType.includes(",") ? params.eventType : ""));
  const [device, setDevice] = useState("");
  const [source, setSource] = useState("");
  const [country, setCountry] = useState(() => params.countryCode ?? "");
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<Array<{ isoCode: string; name: string }>>([]);

  /**
   * Filters turn the spinner on before they change the key the fetch effect
   * watches. Setting it inside that effect instead is a synchronous setState
   * in an effect body — a cascading render, and what
   * react-hooks/set-state-in-effect flags.
   */
  function narrow(apply: () => void) {
    setLoading(true);
    apply();
  }

  const blockIp = useCallback(
    async (ip: string) => {
      setBlockingIp(ip);
      try {
        const res = await fetch("/next-api/admin/platform-settings/analytics-excluded-ips/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip }),
        });
        if (!res.ok) throw new Error();
        setBlockedIps((prev) => new Set(prev).add(ip));
        toast.success(`${ip} added to the analytics exclusion list`);
      } catch {
        toast.error(`Failed to block ${ip}`);
      } finally {
        setBlockingIp(null);
      }
    },
    [toast],
  );

  // The clicked scope minus anything the modal has its own control for.
  // Keeping the two apart is what lets the facet fetch below stay independent
  // of the very filters it populates.
  const scopeParams = useMemo(() => {
    const p: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) if (!OWNED_KEYS.includes(k)) p[k] = v;
    // Empty means "all events", which is no filter at all.
    if (eventType) p.eventType = eventType;
    else if (params.eventType) p.eventType = params.eventType;
    return p;
  }, [params, eventType]);

  const effParams = useMemo(() => {
    const p = { ...scopeParams };
    if (country) p.countryCode = country;
    if (device) p.device = device;
    if (source) p.source = source;
    return p;
  }, [scopeParams, country, device, source]);

  const effKey = new URLSearchParams(effParams).toString();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/next-api/admin/shop/analytics/event-details?${effKey}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // A newer key cancels this effect on the way out, so a superseded response
    // can never land after — and overwrite — a more recent one.
    return () => {
      cancelled = true;
    };
  }, [open, effKey]);

  // Only values with real rows in this scope. Keyed off scopeParams, not
  // effParams, so choosing one filter never shrinks the others' options.
  const scopeKey = new URLSearchParams(scopeParams).toString();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/next-api/admin/shop/analytics/event-detail-filters?${scopeKey}`)
      .then((r) => (r.ok ? r.json() : { sources: [], countries: [] }))
      .then((data) => {
        if (cancelled) return;
        setSourceOptions(Array.isArray(data.sources) ? data.sources : []);
        setCountryOptions(Array.isArray(data.countries) ? data.countries : []);
      })
      .catch(() => {
        if (cancelled) return;
        setSourceOptions([]);
        setCountryOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, scopeKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h3 className={styles.title}>{title}</h3>
            {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={17} strokeWidth={2.3} />
          </button>
        </div>

        <div className={styles.filters}>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Event</span>
            <select className={styles.control} value={eventType} onChange={(e) => narrow(() => setEventType(e.target.value))}>
              <option value="">All events</option>
              {eventOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Country</span>
            <select className={styles.control} value={country} onChange={(e) => narrow(() => setCountry(e.target.value))}>
              <option value="">All countries</option>
              {countryOptions.map((c) => (
                <option key={c.isoCode} value={c.isoCode}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Device</span>
            <select className={styles.control} value={device} onChange={(e) => narrow(() => setDevice(e.target.value))}>
              <option value="">All devices</option>
              {DEVICE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Source</span>
            <select className={styles.control} value={source} onChange={(e) => narrow(() => setSource(e.target.value))}>
              <option value="">All sources</option>
              {sourceOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.state}>Loading…</div>
          ) : rows.length === 0 ? (
            <div className={styles.state}>No events for this selection.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date &amp; time</th>
                  <th>Event</th>
                  <th>Product</th>
                  <th>Country</th>
                  <th>Device</th>
                  <th>Source</th>
                  <th>Qty</th>
                  <th>IP</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={styles.nowrap}>{fmtDateTime(r.createdAt)}</td>
                    <td>
                      <span className={styles.eventTag} title={r.eventType}>
                        {eventTypeLabel(r.eventType)}
                      </span>
                    </td>
                    <td title={r.productTitle ?? undefined}>{r.productTitle ?? "—"}</td>
                    {/* The whole reason the country has to reach the event row:
                        without it every drill-down read "—" for every line. */}
                    <td>{r.countryName ?? r.countryCode ?? "—"}</td>
                    <td>{r.device === "mobile" ? "Mobile" : r.device === "desktop" ? "Desktop" : "—"}</td>
                    <td>{r.source ?? "—"}</td>
                    <td>{r.quantity ?? "—"}</td>
                    <td className={`${styles.nowrap} ${styles.ip}`}>{r.clientIp ?? "—"}</td>
                    <td className={styles.nowrap}>
                      {r.clientIp &&
                        (blockedIps.has(r.clientIp) ? (
                          <span className={styles.blocked}>Blocked</span>
                        ) : (
                          <button
                            type="button"
                            className={styles.blockBtn}
                            onClick={() => blockIp(r.clientIp!)}
                            disabled={blockingIp === r.clientIp}
                          >
                            {blockingIp === r.clientIp ? "Blocking…" : "Block from stats"}
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
