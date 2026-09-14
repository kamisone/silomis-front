"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, Trash2, TrendingUp } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./PriceBandEditor.module.css";

interface Band {
  maxStitches: number;
  priceCents: number;
  label?: string | null;
}

interface Template {
  id: string;
  key: string;
  name: string;
  priceBands: Band[];
}

/**
 * What embroidery costs, by stitch count.
 *
 * Two things make this worth its own panel rather than a row in a settings
 * page. Stitches are the honest unit — machine time, not letters — so the
 * ladder is what actually prices the feature. And the largest band doubles as
 * a hard ceiling: a design past it has no price, so it is refused. That second
 * job is invisible until a shop turns on options that multiply stitch counts,
 * at which point designs that fit the panel with room to spare start coming
 * back as "too many stitches".
 */
export default function PriceBandEditor() {
  const [template, setTemplate] = useState<Template | null>(null);
  const [bands, setBands] = useState<Band[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.get<Template[]>("/next-api/admin/shop/personalization/templates");
        const first = list[0] ?? null;
        setTemplate(first);
        setBands(first?.priceBands ?? []);
      } catch {
        setError("Could not load the price bands.");
      }
    })();
  }, []);

  const update = useCallback((index: number, patch: Partial<Band>) => {
    setBands((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }, []);

  const save = useCallback(async () => {
    if (!template) return;
    setSaving(true);
    setError("");
    try {
      const next = await api.put<Band[]>(`/next-api/admin/shop/personalization/templates/${template.id}/bands`, {
        bands: bands.map((b) => ({ maxStitches: b.maxStitches, priceCents: b.priceCents, label: b.label ?? null })),
      });
      setBands(next);
      setSavedAt(Date.now());
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { message?: string | string[] }) : null;
      const message = Array.isArray(body?.message) ? body?.message[0] : body?.message;
      setError(message || "Could not save the price bands.");
    } finally {
      setSaving(false);
    }
  }, [template, bands]);

  if (!template) return null;

  const sorted = [...bands].sort((a, b) => a.maxStitches - b.maxStitches);
  const ceiling = sorted.length ? sorted[sorted.length - 1].maxStitches : 0;

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>
            <TrendingUp size={15} aria-hidden="true" /> Embroidery pricing
          </h2>
          <p className={styles.sub}>
            Priced by stitch count, because that is machine time. Anything above{" "}
            <strong>{ceiling.toLocaleString()} stitches</strong> is refused — there is no price for it.
          </p>
        </div>
        <button type="button" className={styles.ghostBtn} onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Edit"}
        </button>
      </header>

      {open && (
        <>
          {error && (
            <p className={ui.error}>
              <AlertTriangle size={14} aria-hidden="true" /> {error}
            </p>
          )}

          <div className={styles.bands}>
            {sorted.map((band, i) => (
              <div key={i} className={styles.band}>
                <label className={ui.field}>
                  <span className={ui.label}>Up to (stitches)</span>
                  <input
                    className={ui.input}
                    type="number"
                    min={1}
                    step={500}
                    value={band.maxStitches}
                    onChange={(e) => update(bands.indexOf(band), { maxStitches: Number(e.target.value) })}
                  />
                </label>
                <label className={ui.field}>
                  <span className={ui.label}>Price (€)</span>
                  <input
                    className={ui.input}
                    type="number"
                    min={0}
                    step={0.5}
                    value={(band.priceCents / 100).toFixed(2)}
                    onChange={(e) => update(bands.indexOf(band), { priceCents: Math.round(Number(e.target.value) * 100) })}
                  />
                </label>
                <label className={ui.field}>
                  <span className={ui.label}>Label</span>
                  <input
                    className={ui.input}
                    value={band.label ?? ""}
                    onChange={(e) => update(bands.indexOf(band), { label: e.target.value })}
                    placeholder="Medium"
                  />
                </label>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setBands((prev) => prev.filter((b) => b !== band))}
                  disabled={bands.length < 2}
                  title={bands.length < 2 ? "At least one band is required" : "Remove this band"}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() =>
                setBands((prev) => [
                  ...prev,
                  // A new band starts above the current ceiling, which is the
                  // only place a new one can sensibly go.
                  { maxStitches: (prev.reduce((m, b) => Math.max(m, b.maxStitches), 0) || 0) + 5000, priceCents: 0, label: "" },
                ])
              }
            >
              <Plus size={14} aria-hidden="true" /> Add a band
            </button>
            <button type="button" className={styles.primaryBtn} onClick={save} disabled={saving}>
              {saving ? <Loader2 size={14} className={styles.spin} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
              Save pricing
            </button>
            {savedAt > 0 && !saving && <span className={styles.saved}>Saved</span>}
          </div>

          <p className={styles.note}>
            Thickness, outline, 3D puff and curve all multiply the stitch count — extra bold with an outline is about
            two and a half times the plain design. If customers are being refused on designs that clearly fit, this
            ceiling is why.
          </p>
        </>
      )}
    </section>
  );
}
