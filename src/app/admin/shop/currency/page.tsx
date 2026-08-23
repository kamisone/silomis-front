"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

type SymbolPosition = "before" | "after";

interface CurrencyConfig {
  code: string;
  symbolPosition: SymbolPosition;
  decimalPlaces: number;
}

const COMMON_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD"];

function preview(config: CurrencyConfig): string {
  const amount = (1234.5).toFixed(config.decimalPlaces);
  return config.symbolPosition === "before" ? `${config.code} ${amount}` : `${amount} ${config.code}`;
}

export default function CurrencySettingsPage() {
  const [config, setConfig] = useState<CurrencyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<CurrencyConfig>("/next-api/admin/platform-settings/currency")
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.put<CurrencyConfig>("/next-api/admin/platform-settings/currency", config);
      setConfig(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Save failed") : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Currency</h1>
      </div>

      <div className={ui.card}>
        {loading || !config ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 480 }}>
            {error && <p className={ui.error}>{error}</p>}

            <div className={ui.field}>
              <label className={ui.label}>Currency code</label>
              <select className={ui.select} value={config.code} onChange={(e) => setConfig({ ...config, code: e.target.value })}>
                {[...new Set([config.code, ...COMMON_CURRENCIES])].map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Symbol position</label>
                <select className={ui.select} value={config.symbolPosition} onChange={(e) => setConfig({ ...config, symbolPosition: e.target.value as SymbolPosition })}>
                  <option value="before">Before amount</option>
                  <option value="after">After amount</option>
                </select>
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Decimal places</label>
                <input
                  className={ui.input}
                  type="number"
                  min={0}
                  max={4}
                  value={config.decimalPlaces}
                  onChange={(e) => setConfig({ ...config, decimalPlaces: parseInt(e.target.value || "0", 10) })}
                />
              </div>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)" }}>Preview: {preview(config)}</p>
            <p style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>Formatting only — this does not change what currency Stripe charges in.</p>

            <div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              {saved && <span style={{ marginLeft: "0.75rem", fontSize: "0.85rem", color: "var(--color-secondary)" }}>Saved</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
