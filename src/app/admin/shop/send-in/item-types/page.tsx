"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, ChevronDown, ImageOff, Loader2, PackageCheck, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import LocalizedTextField, { type LocalizedTextMap } from "@/components/admin/ui/LocalizedTextField";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import Switch from "@/components/admin/ui/Switch";
import ui from "@/components/admin/ui/admin-ui.module.css";
import studio from "../../personalization/studio/studio.module.css";
import styles from "./item-types.module.css";

const TRANSLATE_TEXT = "/next-api/admin/shop/translate/text";

interface ItemType {
  id: string;
  key: string;
  label: LocalizedTextMap;
  hint: LocalizedTextMap;
  variantId: string;
  sku: string;
  priceCents: number;
  maxChars: number;
  allowPuff: boolean;
  imageKey: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

function apiMessage(err: unknown, fallback: string): string {
  const body = err instanceof ApiError ? (err.body as { message?: string | string[] }) : null;
  const message = Array.isArray(body?.message) ? body?.message[0] : body?.message;
  return message || fallback;
}

function eur(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * What a customer may post in for embroidery, and what each costs to handle
 * and send back.
 *
 * Each type is a card: its name in every language, its price, and the two
 * things the editor needs to know — how big such a panel usually is, which is
 * the scale the customer's photo is shown at, and how many letters fit on it.
 * Order here is the order on the storefront.
 */
export default function SendInItemTypesPage() {
  const { toast } = useToast();
  const [types, setTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ label: LocalizedTextMap; priceCents: number }>({ label: {}, priceCents: 990 });

  const load = useCallback(async () => {
    try {
      setTypes(await api.get<ItemType[]>("/next-api/admin/shop/send-in/item-types"));
    } catch {
      setError("Could not load the item types.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setSaving(true);
      try {
        const updated = await api.patch<ItemType>(`/next-api/admin/shop/send-in/item-types/${id}`, body);
        setTypes((prev) => prev.map((t) => (t.id === id ? updated : t)));
      } catch (err) {
        toast.error(apiMessage(err, "Could not save the item type"));
      } finally {
        setSaving(false);
      }
    },
    [toast],
  );

  const create = useCallback(async () => {
    setSaving(true);
    try {
      const created = await api.post<ItemType>("/next-api/admin/shop/send-in/item-types", { label: draft.label, priceCents: draft.priceCents });
      setTypes((prev) => [...prev, created]);
      setAdding(false);
      setDraft({ label: {}, priceCents: 990 });
      setOpenId(created.id);
      toast.success("Item type added — fill in its panel size below");
    } catch (err) {
      toast.error(apiMessage(err, "Could not add the item type"));
    } finally {
      setSaving(false);
    }
  }, [draft, toast]);

  const remove = useCallback(
    async (t: ItemType) => {
      const label = t.label.en ?? Object.values(t.label)[0] ?? t.key;
      if (!confirm(`Remove "${label}"? If it has already been ordered it is switched off instead of deleted.`)) return;
      setSaving(true);
      try {
        const res = await api.delete<{ deleted: boolean }>(`/next-api/admin/shop/send-in/item-types/${t.id}`);
        if (res.deleted) {
          setTypes((prev) => prev.filter((x) => x.id !== t.id));
          toast.success("Removed");
        } else {
          setTypes((prev) => prev.map((x) => (x.id === t.id ? { ...x, isActive: false } : x)));
          toast.info("Already ordered before, so it was switched off rather than deleted");
        }
      } catch (err) {
        toast.error(apiMessage(err, "Could not remove the item type"));
      } finally {
        setSaving(false);
      }
    },
    [toast],
  );

  /** Swaps sort orders with a neighbour; the list is the storefront's order. */
  const move = useCallback(
    async (index: number, dir: -1 | 1) => {
      const a = types[index];
      const b = types[index + dir];
      if (!a || !b) return;
      const next = [...types];
      next[index] = { ...b, sortOrder: a.sortOrder };
      next[index + dir] = { ...a, sortOrder: b.sortOrder };
      setTypes(next);
      await Promise.all([
        api.patch(`/next-api/admin/shop/send-in/item-types/${a.id}`, { sortOrder: b.sortOrder === a.sortOrder ? b.sortOrder + dir : b.sortOrder }),
        api.patch(`/next-api/admin/shop/send-in/item-types/${b.id}`, { sortOrder: a.sortOrder }),
      ]).catch(() => toast.error("Could not reorder"));
    },
    [types, toast],
  );

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Send-in item types</h1>
        <div className={ui.rowActions}>
          <Link href="/admin/shop/send-in" className={studio.ghostBtn}>
            <PackageCheck size={14} aria-hidden="true" /> Send-in desk
          </Link>
          <button type="button" className={studio.primaryBtn} onClick={() => setAdding(true)} disabled={adding}>
            <Plus size={14} aria-hidden="true" /> Add an item type
          </button>
        </div>
      </div>
      <p className={ui.pageHint}>
        What customers may post in for embroidery, in the order shown on the storefront. The price is charged once per side the
        customer photographs and embroiders (up to three) and is the whole price of that side — embroidery, handling and
        return; what the customer designs on it never changes the figure.
      </p>

      {error && <p className={ui.error}>{error}</p>}

      {adding && (
        <div className={`${ui.card} ${styles.addCard}`}>
          <LocalizedTextField label="Name" value={draft.label} onCommit={(label) => setDraft((d) => ({ ...d, label }))} onDraftChange={(label) => setDraft((d) => ({ ...d, label }))} translateEndpoint={TRANSLATE_TEXT} maxLength={80} />
          <label className={ui.field}>
            <span className={ui.label}>Price per side (€)</span>
            <input className={ui.input} type="number" step={0.1} min={0} value={draft.priceCents / 100} onChange={(e) => setDraft((d) => ({ ...d, priceCents: Math.round(Number(e.target.value) * 100) }))} />
          </label>
          <div className={ui.rowActions}>
            <button type="button" className={studio.ghostBtn} onClick={() => setAdding(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className={studio.primaryBtn} onClick={() => void create()} disabled={saving || !Object.values(draft.label).some(Boolean)}>
              {saving ? <Loader2 size={14} className={styles.spin} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Add
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className={ui.muted}>Loading…</p>
      ) : types.length === 0 ? (
        <div className={ui.emptyState}>
          <PackageCheck size={22} aria-hidden="true" />
          <p>No item types yet — add one to open the service.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {types.map((t, i) => {
            const open = openId === t.id;
            return (
              <article key={t.id} className={`${studio.placementCard} ${t.isActive ? "" : studio.placementCardOff}`}>
                <header className={studio.placementHead}>
                  <div className={studio.placementIdent}>
                    {t.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.imageUrl} alt="" className={studio.placementThumb} />
                    ) : (
                      <span className={studio.placementThumbEmpty}>
                        <ImageOff size={15} aria-hidden="true" />
                      </span>
                    )}
                    <div>
                      <strong className={studio.placementName}>{t.label.en ?? Object.values(t.label)[0] ?? t.key}</strong>
                      <span className={studio.placementSub}>
                        <code className={ui.codeChip}>{t.key}</code> €{eur(t.priceCents)} / side · {t.maxChars} chars
                        {t.allowPuff ? " · 3D puff" : ""}
                      </span>
                    </div>
                  </div>
                  <div className={studio.placementHeadRight}>
                    <button type="button" className={studio.iconBtn} onClick={() => void move(i, -1)} disabled={i === 0 || saving} title="Move up">
                      <ArrowUp size={13} aria-hidden="true" />
                    </button>
                    <button type="button" className={studio.iconBtn} onClick={() => void move(i, 1)} disabled={i === types.length - 1 || saving} title="Move down">
                      <ArrowDown size={13} aria-hidden="true" />
                    </button>
                    <label className={studio.activeToggle}>
                      <input type="checkbox" checked={t.isActive} onChange={(e) => void patch(t.id, { isActive: e.target.checked })} disabled={saving} />
                      <span>Offered</span>
                    </label>
                    <button type="button" className={studio.iconBtn} onClick={() => void remove(t)} title="Remove" disabled={saving}>
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                    <button type="button" className={`${studio.iconBtn} ${open ? studio.iconBtnOpen : ""}`} onClick={() => setOpenId(open ? "" : t.id)} aria-expanded={open} title={open ? "Collapse" : "Edit"}>
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                  </div>
                </header>

                {open && (
                  <div className={studio.placementBody}>
                    <LocalizedTextField label="Name" value={t.label} onCommit={(label) => void patch(t.id, { label })} translateEndpoint={TRANSLATE_TEXT} maxLength={80} />
                    <LocalizedTextField label="Hint" hint="The line under the name on the card — e.g. which part is usually embroidered." value={t.hint} onCommit={(hint) => void patch(t.id, { hint })} translateEndpoint={TRANSLATE_TEXT} maxLength={160} />
                    <div className={studio.numberGrid}>
                      <NumberField label="Price per side (€)" value={t.priceCents / 100} step={0.1} onCommit={(v) => void patch(t.id, { priceCents: Math.round(v * 100) })} />
                      <NumberField label="Max characters" value={t.maxChars} onCommit={(v) => void patch(t.id, { maxChars: Math.round(v) })} />
                    </div>
                    <Switch label="3D puff allowed" hint="Only where a frame can take the height of foam — a cap front or a jacket back, not a beanie cuff." checked={t.allowPuff} onChange={(allowPuff) => void patch(t.id, { allowPuff })} disabled={saving} />
                    <MediaPicker label="Picture on the card" mediaType="image" value={t.imageKey} previewUrl={t.imageUrl} onChange={(key) => void patch(t.id, { imageKey: key })} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A number input that only reports on blur, so typing "1" of "15" saves nothing. */
function NumberField({ label, value, step = 1, onCommit }: { label: string; value: number; step?: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  return (
    <label className={ui.field}>
      <span className={ui.label}>{label}</span>
      <input
        className={ui.input}
        type="number"
        step={step}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (draft !== null && Number.isFinite(n) && n !== value) onCommit(n);
          setDraft(null);
        }}
      />
    </label>
  );
}
