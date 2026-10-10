"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./EmbroideryProductionSetting.module.css";

const MAX_DAYS = 30;

/**
 * How long embroidery takes before an order ships. The checkout adds it to
 * the shipping method's delivery estimate for a basket with embroidery, so
 * "Arrives between …" includes the stitching, and shows "Ships by …" beside
 * "Embroidered in France".
 */
export default function EmbroideryProductionSetting() {
  const { toast } = useToast();
  const [saved, setSaved] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ embroidery?: { productionDays?: number } }>("/next-api/public/platform-settings")
      .then((cfg) => {
        if (cancelled) return;
        const days = cfg.embroidery?.productionDays ?? 0;
        setSaved(days);
        setValue(String(days));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const days = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(days) && days >= 0 && days <= MAX_DAYS;
  const dirty = valid && days !== saved;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    try {
      await api.put("/next-api/admin/platform-settings/embroidery", { productionDays: days });
      setSaved(days);
      toast.success("Production time saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Could not save the production time") : "Could not save the production time");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={`${ui.card} ${styles.card}`} onSubmit={save}>
      <div className={styles.text}>
        <h2 className={styles.title}>Embroidery production time</h2>
        <p className={ui.hint}>
          Business days to embroider an order before it ships. At checkout it is added to the shipping method&apos;s delivery
          time for baskets with embroidery, and shown as &ldquo;Ships by …&rdquo; next to &ldquo;Embroidered in France&rdquo;. Use 0 if
          embroidered orders ship as fast as the rest.
        </p>
      </div>
      <div className={styles.controls}>
        <label className={styles.inputWrap}>
          <input
            className={`${ui.input} ${styles.input}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_DAYS}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saved === null}
            aria-label="Production time in business days"
            aria-invalid={value !== "" && !valid ? true : undefined}
          />
          <span className={styles.unit}>business days</span>
        </label>
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {value !== "" && !valid && <p className={styles.error}>Enter a whole number from 0 to {MAX_DAYS}.</p>}
    </form>
  );
}
