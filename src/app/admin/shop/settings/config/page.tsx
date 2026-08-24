"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export default function CommerceConfigPage() {
  const { toast } = useToast();
  const [ipsValue, setIpsValue] = useState("");
  const [ipsCount, setIpsCount] = useState(0);
  const [ipsLoading, setIpsLoading] = useState(true);
  const [ipsSaving, setIpsSaving] = useState(false);

  const [botValue, setBotValue] = useState("");
  const [botCount, setBotCount] = useState(0);
  const [botLoading, setBotLoading] = useState(true);
  const [botSaving, setBotSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ rules: string[] }>("/next-api/admin/platform-settings/analytics-excluded-ips")
      .then((data) => {
        setIpsCount(data.rules.length);
        setIpsValue(data.rules.join("\n"));
      })
      .finally(() => setIpsLoading(false));

    api
      .get<{ patterns: string[] }>("/next-api/admin/platform-settings/analytics-bot-user-agents")
      .then((data) => {
        setBotCount(data.patterns.length);
        setBotValue(data.patterns.join("\n"));
      })
      .finally(() => setBotLoading(false));
  }, []);

  async function saveIps() {
    setIpsSaving(true);
    try {
      const data = await api.put<{ rules: string[]; invalid: string[] }>("/next-api/admin/platform-settings/analytics-excluded-ips", { value: ipsValue });
      setIpsCount(data.rules.length);
      setIpsValue(data.rules.join("\n"));
      if (data.invalid.length) {
        toast.error(`Ignored ${data.invalid.length} invalid entr${data.invalid.length === 1 ? "y" : "ies"}: ${data.invalid.join(", ")}`);
      } else {
        toast.success(data.rules.length ? `Saved — ${data.rules.length} address${data.rules.length === 1 ? "" : "es"} excluded from analytics` : "Saved — no addresses excluded");
      }
    } catch (err) {
      toast.error(errMessage(err, "Failed to save the exclusion list"));
    } finally {
      setIpsSaving(false);
    }
  }

  async function saveBotPatterns() {
    setBotSaving(true);
    try {
      const data = await api.put<{ patterns: string[] }>("/next-api/admin/platform-settings/analytics-bot-user-agents", { value: botValue });
      setBotCount(data.patterns.length);
      setBotValue(data.patterns.join("\n"));
      toast.success(data.patterns.length ? `Saved — ${data.patterns.length} pattern${data.patterns.length === 1 ? "" : "s"} filtered from analytics` : "Saved — bot filtering disabled");
    } catch (err) {
      toast.error(errMessage(err, "Failed to save the bot filter list"));
    } finally {
      setBotSaving(false);
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Commerce Configuration</h1>
      </div>

      <div className={ui.card} style={{ maxWidth: 720, marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.35rem" }}>Analytics IP exclusions</h2>
        <p style={{ fontSize: "0.8rem", lineHeight: 1.6, color: "var(--color-secondary)", margin: "0 0 1rem" }}>
          Traffic from these addresses is not recorded at all — no views, cart events or checkout steps. Use it to keep your own team&apos;s browsing out of the figures you use to decide what to stock.
        </p>

        <div className={ui.field}>
          <label className={ui.label}>One per line</label>
          <textarea
            className={ui.textarea}
            value={ipsValue}
            onChange={(e) => setIpsValue(e.target.value)}
            disabled={ipsLoading}
            rows={7}
            spellCheck={false}
            placeholder={"81.20.4.7\n81.20.4.0/24\n2a01:e0a::1"}
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          />
        </div>
        <p style={{ fontSize: "0.75rem", lineHeight: 1.6, color: "var(--color-secondary)", margin: "0.5rem 0 0" }}>
          Accepts a single address (<code>81.20.4.7</code>), an IPv4 range in CIDR notation (<code>81.20.4.0/24</code> covers .0–.255), or an IPv6 address. IPv6 is matched exactly — ranges are IPv4 only.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginTop: "1.1rem" }}>
          <Button onClick={saveIps} disabled={ipsSaving || ipsLoading}>
            {ipsSaving ? "Saving…" : "Save"}
          </Button>
          <span style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>{ipsLoading ? "Loading…" : ipsCount === 0 ? "No exclusions — all traffic is recorded" : `${ipsCount} address${ipsCount === 1 ? "" : "es"} currently excluded`}</span>
        </div>

        <p style={{ fontSize: "0.75rem", lineHeight: 1.6, color: "var(--color-secondary)", margin: "1rem 0 0", paddingTop: "0.85rem", borderTop: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)" }}>
          Applies to events recorded from now on. Anything already counted stays in the reports — and a change can take up to a minute to reach every server.
        </p>
      </div>

      <div className={ui.card} style={{ maxWidth: 720 }}>
        <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.35rem" }}>Bot / crawler filtering</h2>
        <p style={{ fontSize: "0.8rem", lineHeight: 1.6, color: "var(--color-secondary)", margin: "0 0 1rem" }}>A request whose User-Agent contains any of these (case-insensitive) is not recorded. Pre-filled with a broad default list of known crawlers and scripted clients — edit freely, an empty list disables bot filtering.</p>

        <div className={ui.field}>
          <label className={ui.label}>One per line</label>
          <textarea
            className={ui.textarea}
            value={botValue}
            onChange={(e) => setBotValue(e.target.value)}
            disabled={botLoading}
            rows={7}
            spellCheck={false}
            placeholder={"bot\nspider\nfacebookexternalhit\ncurl/"}
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          />
        </div>
        <p style={{ fontSize: "0.75rem", lineHeight: 1.6, color: "var(--color-secondary)", margin: "0.5rem 0 0" }}>A request with no User-Agent header at all is also treated as a bot — every real browser sends one.</p>

        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginTop: "1.1rem" }}>
          <Button onClick={saveBotPatterns} disabled={botSaving || botLoading}>
            {botSaving ? "Saving…" : "Save"}
          </Button>
          <span style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>{botLoading ? "Loading…" : botCount === 0 ? "No patterns — bot filtering disabled" : `${botCount} pattern${botCount === 1 ? "" : "s"} currently filtered`}</span>
        </div>

        <p style={{ fontSize: "0.75rem", lineHeight: 1.6, color: "var(--color-secondary)", margin: "1rem 0 0", paddingTop: "0.85rem", borderTop: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)" }}>
          Applies to events recorded from now on. Anything already counted stays in the reports — and a change can take up to a minute to reach every server.
        </p>
      </div>
    </div>
  );
}
