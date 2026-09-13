"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./threads.module.css";

interface Thread {
  id: string;
  brand: string;
  code: string;
  name: string;
  hex: string;
  isActive: boolean;
  sortOrder: number;
}

const BLANK = { brand: "Madeira Polyneon", code: "", name: "", hex: "#129c98" };

/** Message from a coded 400, or a fallback — the API names the real problem. */
function apiMessage(err: unknown, fallback: string): string {
  const body = err instanceof ApiError ? (err.body as { message?: string | string[] }) : null;
  const message = Array.isArray(body?.message) ? body?.message[0] : body?.message;
  return message || fallback;
}

/**
 * The thread wall.
 *
 * This is the list of spools the shop physically holds — a customer can only
 * pick a colour somebody can actually load on the machine, which is why this is
 * a table of supplier codes and not a colour picker. The hex value is only how
 * the swatch looks on screen; the code is what gets bought and threaded.
 */
export default function ThreadColoursPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [editingId, setEditingId] = useState("");

  const load = useCallback(async () => {
    try {
      setThreads(await api.get<Thread[]>("/next-api/admin/shop/personalization/threads"));
    } catch {
      setError("Could not load the thread colours.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => `${t.brand} ${t.code} ${t.name}`.toLowerCase().includes(q));
  }, [threads, search]);

  const activeCount = threads.filter((t) => t.isActive).length;

  const patch = useCallback(
    async (id: string, body: Partial<Thread>) => {
      setSaving(true);
      setError("");
      try {
        await api.patch(`/next-api/admin/shop/personalization/threads/${id}`, body);
        await load();
      } catch (err) {
        setError(apiMessage(err, "Could not save that colour."));
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const create = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      await api.post("/next-api/admin/shop/personalization/threads", draft);
      setDraft({ ...BLANK });
      setAdding(false);
      await load();
    } catch (err) {
      setError(apiMessage(err, "Could not add that colour."));
    } finally {
      setSaving(false);
    }
  }, [draft, load]);

  const remove = useCallback(
    async (t: Thread) => {
      if (!window.confirm(`Remove ${t.brand} ${t.code} — ${t.name}? Orders already placed keep their own copy.`)) return;
      setSaving(true);
      setError("");
      try {
        await api.delete(`/next-api/admin/shop/personalization/threads/${t.id}`);
        await load();
      } catch (err) {
        setError(apiMessage(err, "Could not remove that colour."));
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  /** Swaps a spool with its neighbour — the order is the order in the editor. */
  const move = useCallback(
    async (index: number, delta: -1 | 1) => {
      const a = threads[index];
      const b = threads[index + delta];
      if (!a || !b) return;
      setSaving(true);
      try {
        await Promise.all([
          api.patch(`/next-api/admin/shop/personalization/threads/${a.id}`, { sortOrder: b.sortOrder }),
          api.patch(`/next-api/admin/shop/personalization/threads/${b.id}`, { sortOrder: a.sortOrder }),
        ]);
        await load();
      } catch {
        setError("Could not reorder the colours.");
      } finally {
        setSaving(false);
      }
    },
    [threads, load],
  );

  const draftValid = draft.code.trim() && draft.name.trim() && draft.brand.trim() && /^#[0-9a-fA-F]{6}$/.test(draft.hex);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.pageTitle}>Thread colours</h1>
          <p className={ui.pageHint}>
            The spools you actually hold. A customer can only choose a colour from this list, and the code is what your
            operator loads on the machine — so add a colour here only once it is on the shelf.
          </p>
        </div>
      </div>

      {error && (
        <p className={ui.error}>
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </p>
      )}

      <div className={ui.kpiStrip}>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Offered</span>
          <span className={ui.kpiValue}>{activeCount}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>On the list</span>
          <span className={ui.kpiValue}>{threads.length}</span>
        </div>
      </div>

      <div className={ui.toolbar}>
        <button type="button" className={styles.primaryBtn} onClick={() => setAdding((v) => !v)}>
          <Plus size={14} aria-hidden="true" /> Add a colour
        </button>
        <div className={styles.searchWrap}>
          <Search size={15} aria-hidden="true" className={styles.searchIcon} />
          <input
            className={ui.searchInput}
            placeholder="Brand, code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {adding && (
        <div className={styles.addCard}>
          {/* The swatch is the size it will be in the editor, next to the
              fields — matching a spool to a screen colour is the whole job. */}
          <div className={styles.addPreview}>
            <span className={styles.addChip} style={{ background: draft.hex }} aria-hidden="true" />
            <input
              type="color"
              className={styles.colorInput}
              value={/^#[0-9a-fA-F]{6}$/.test(draft.hex) ? draft.hex : "#129c98"}
              onChange={(e) => setDraft((d) => ({ ...d, hex: e.target.value }))}
              aria-label="Pick the colour"
            />
          </div>

          <div className={styles.addFields}>
            <label className={ui.field}>
              <span className={ui.label}>Brand</span>
              <input className={ui.input} value={draft.brand} onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Code</span>
              <input
                className={ui.input}
                value={draft.code}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                placeholder="1791"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Name</span>
              <input
                className={ui.input}
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Teal"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Hex</span>
              <input
                className={`${ui.input} ${styles.hexInput}`}
                value={draft.hex}
                onChange={(e) => setDraft((d) => ({ ...d, hex: e.target.value }))}
                placeholder="#129c98"
                spellCheck={false}
              />
            </label>
          </div>

          <div className={styles.addActions}>
            <button type="button" className={styles.ghostBtn} onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="button" className={styles.primaryBtn} onClick={create} disabled={saving || !draftValid}>
              {saving ? <Loader2 size={14} className={styles.spin} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
              Add colour
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className={ui.muted}>Loading…</p>
      ) : !visible.length ? (
        <div className={ui.emptyState}>
          <p>{search ? "No colour matches that." : "No thread colours yet — add the first spool you hold."}</p>
        </div>
      ) : (
        <ul className={styles.wall}>
          {visible.map((t) => {
            const index = threads.findIndex((x) => x.id === t.id);
            return (
              <li key={t.id} className={`${styles.spool} ${t.isActive ? "" : styles.spoolOff}`}>
                {editingId === t.id ? (
                  <EditRow thread={t} onCancel={() => setEditingId("")} onSave={async (body) => { await patch(t.id, body); setEditingId(""); }} saving={saving} />
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.chipBtn}
                      style={{ background: t.hex }}
                      onClick={() => setEditingId(t.id)}
                      aria-label={`Edit ${t.name}`}
                    />
                    <div className={styles.spoolMeta}>
                      <strong className={styles.spoolName}>{t.name}</strong>
                      <span className={styles.spoolCode}>
                        {t.brand} {t.code}
                      </span>
                    </div>
                    <div className={styles.spoolActions}>
                      {/* Order here is the order on the storefront palette, so
                          the colours a shop leads with are its own choice. */}
                      <button type="button" className={styles.iconBtn} onClick={() => move(index, -1)} disabled={saving || index === 0} title="Move up">
                        <ArrowUp size={12} aria-hidden="true" />
                      </button>
                      <button type="button" className={styles.iconBtn} onClick={() => move(index, 1)} disabled={saving || index === threads.length - 1} title="Move down">
                        <ArrowDown size={12} aria-hidden="true" />
                      </button>
                      <label className={styles.activeToggle} title={t.isActive ? "Offered to customers" : "Hidden from customers"}>
                        <input type="checkbox" checked={t.isActive} onChange={(e) => patch(t.id, { isActive: e.target.checked })} disabled={saving} />
                      </label>
                      <button type="button" className={styles.iconBtn} onClick={() => remove(t)} disabled={saving} title="Remove">
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Inline edit — a spool is four short fields, so a modal would be overkill. */
function EditRow({
  thread,
  onCancel,
  onSave,
  saving,
}: {
  thread: Thread;
  onCancel: () => void;
  onSave: (body: Partial<Thread>) => Promise<void>;
  saving: boolean;
}) {
  const [d, setD] = useState({ brand: thread.brand, code: thread.code, name: thread.name, hex: thread.hex });
  const valid = d.code.trim() && d.name.trim() && d.brand.trim() && /^#[0-9a-fA-F]{6}$/.test(d.hex);

  return (
    <div className={styles.editRow}>
      <div className={styles.addPreview}>
        <span className={styles.addChip} style={{ background: d.hex }} aria-hidden="true" />
        <input
          type="color"
          className={styles.colorInput}
          value={/^#[0-9a-fA-F]{6}$/.test(d.hex) ? d.hex : "#129c98"}
          onChange={(e) => setD((v) => ({ ...v, hex: e.target.value }))}
          aria-label="Pick the colour"
        />
      </div>
      <div className={styles.editFields}>
        <input className={ui.input} value={d.name} onChange={(e) => setD((v) => ({ ...v, name: e.target.value }))} placeholder="Name" />
        <input className={ui.input} value={d.brand} onChange={(e) => setD((v) => ({ ...v, brand: e.target.value }))} placeholder="Brand" />
        <input className={ui.input} value={d.code} onChange={(e) => setD((v) => ({ ...v, code: e.target.value }))} placeholder="Code" />
        <input className={`${ui.input} ${styles.hexInput}`} value={d.hex} onChange={(e) => setD((v) => ({ ...v, hex: e.target.value }))} spellCheck={false} />
      </div>
      <div className={styles.spoolActions}>
        <button type="button" className={styles.iconBtn} onClick={onCancel} title="Cancel">
          <X size={12} aria-hidden="true" />
        </button>
        <button type="button" className={styles.primaryBtn} onClick={() => onSave(d)} disabled={saving || !valid}>
          {saving ? <Loader2 size={13} className={styles.spin} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
          Save
        </button>
      </div>
    </div>
  );
}
