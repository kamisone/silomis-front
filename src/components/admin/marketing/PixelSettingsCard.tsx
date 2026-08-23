"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface PlatformConfig {
  metaPixel: { pixelId: string | null; enabled: boolean };
  tiktokPixel: { pixelId: string | null; enabled: boolean };
}

interface PixelSettingsCardProps {
  platform: "meta" | "tiktok";
  title: string;
  description: string;
  idLabel: string;
  idPlaceholder: string;
  /** Regex source + flags — a RegExp instance can't cross the server/client component boundary as a prop. */
  idPattern: { source: string; flags?: string };
  idHint: string;
  idErrorText: string;
  serverSideLabel: string;
  saveUrl: string;
  statusUrl: string;
}

export default function PixelSettingsCard({ platform, title, description, idLabel, idPlaceholder, idPattern, idHint, idErrorText, serverSideLabel, saveUrl, statusUrl }: PixelSettingsCardProps) {
  const idRegex = new RegExp(idPattern.source, idPattern.flags);
  const [pixelId, setPixelId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [serverSideConfigured, setServerSideConfigured] = useState<boolean | null>(null);
  const [initial, setInitial] = useState({ pixelId: "", enabled: false });

  useEffect(() => {
    api
      .get<PlatformConfig>("/next-api/public/platform-settings")
      .then((data) => {
        const cfg = platform === "meta" ? data.metaPixel : data.tiktokPixel;
        setPixelId(cfg.pixelId ?? "");
        setEnabled(cfg.enabled);
        setInitial({ pixelId: cfg.pixelId ?? "", enabled: cfg.enabled });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));

    api
      .get<{ configured: boolean }>(statusUrl)
      .then((data) => setServerSideConfigured(data.configured))
      .catch(() => setServerSideConfigured(false));
  }, [platform, statusUrl]);

  const trimmedId = pixelId.trim();
  const idValid = idRegex.test(trimmedId);
  const dirty = trimmedId !== initial.pixelId || enabled !== initial.enabled;

  async function handleSave() {
    setSaving(true);
    setStatus("idle");
    try {
      await api.put(saveUrl, { pixelId: trimmedId || null, enabled });
      setInitial({ pixelId: trimmedId, enabled });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className={ui.card} style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.35rem" }}>{title}</h2>
      <p style={{ fontSize: "0.8rem", lineHeight: 1.6, color: "var(--color-secondary)", margin: "0 0 1rem" }}>{description}</p>

      <div className={ui.field}>
        <label className={ui.label}>{idLabel}</label>
        <input
          className={ui.input}
          value={pixelId}
          onChange={(e) => {
            setPixelId(e.target.value);
            setStatus("idle");
          }}
          placeholder={idPlaceholder}
        />
        {trimmedId && !idValid && (
          <p className={ui.error} style={{ marginTop: "0.35rem" }}>
            {idErrorText}
          </p>
        )}
        <p style={{ fontSize: "0.75rem", color: "var(--color-secondary)", margin: "0.35rem 0 0" }}>{idHint}</p>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", margin: "0.75rem 0" }}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!idValid && !enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setStatus("idle");
          }}
        />
        {enabled ? "Enabled" : "Disabled"}
      </label>

      <div style={{ padding: "0.85rem 1rem", background: "var(--color-surface-tint)", borderRadius: 10, marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", fontWeight: 600 }}>
          <span>{serverSideLabel}</span>
          {serverSideConfigured === null ? <span className={ui.badge}>Checking…</span> : serverSideConfigured ? <span className={ui.badgeActive}>Configured</span> : <span className={ui.badgeInactive}>Not configured</span>}
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--color-secondary)", margin: "0.4rem 0 0" }}>
          {serverSideConfigured ? "Purchase events are also sent server-side and deduplicated with the browser pixel." : "Set the access token in the server environment to enable server-side Purchase tracking — this isn't editable here since it's a credential, not a setting."}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
        <Button onClick={handleSave} disabled={saving || (!dirty && status !== "error") || (enabled && !idValid)}>
          {saving ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Retry" : dirty ? "Save" : "No changes"}
        </Button>
        {status === "saved" && <span style={{ fontSize: "0.8rem", color: "var(--color-primary)" }}>Live on the shop within a minute.</span>}
      </div>
    </div>
  );
}
