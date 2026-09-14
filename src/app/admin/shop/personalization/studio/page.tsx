"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2, AlertTriangle, ImageOff, ChevronDown, Crosshair } from "lucide-react";
import { api } from "@/lib/api";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import ProductPicker from "@/components/admin/shop/ProductPicker";
import LocalizedTextField, { type LocalizedTextMap } from "@/components/admin/ui/LocalizedTextField";
import PlacementTraceEditor from "@/components/admin/shop/PlacementTraceEditor";
import { isUsableQuad, defaultQuad, type Quad } from "@/lib/shop/perspective";
import PriceBandEditor from "@/components/admin/shop/PriceBandEditor";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./studio.module.css";

const TRANSLATE_TEXT = "/next-api/admin/shop/translate/text";

interface Placement {
  id: string;
  key: string;
  label: LocalizedTextMap;
  hint: LocalizedTextMap | null;
  fieldWidthMm: number;
  fieldHeightMm: number;
  maxColors: number;
  maxChars: number;
  priceCents: number;
  isActive: boolean;
  sortOrder: number;
  mediaKey: string | null;
  imageUrl: string | null;
  isTraced: boolean;
  corners: { x: number; y: number }[];
}

function eur(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * The placement studio.
 *
 * A position is one thing: a name, a price, a hoop field, and the photograph a
 * customer places artwork on. It is defined once for the shop rather than per
 * product — "Front panel" is the front panel, photographed once — so everything
 * about it lives on one card, and adding a position means finishing it.
 */
export default function PlacementStudioPage() {
  const [productId, setProductId] = useState("");
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState("");
  const [draft, setDraft] = useState<{ key: string; label: LocalizedTextMap; mediaKey: string; url: string }>({
    key: "",
    label: {},
    mediaKey: "",
    url: "",
  });

  const load = useCallback(async () => {
    if (!productId) {
      setPlacements([]);
      return;
    }
    setLoading(true);
    try {
      setPlacements(await api.get<Placement[]>(`/next-api/admin/shop/personalization/products/${productId}/placements`));
    } catch {
      setError("Could not load this product's positions.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  // A position belongs to one product, so nothing from the last one carries over.
  useEffect(() => {
    setOpenId("");
    setAdding(false);
  }, [productId]);

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setSaving(true);
      setError("");
      try {
        await api.patch(`/next-api/admin/shop/personalization/placements/${id}`, body);
        await load();
      } catch {
        setError("Could not save that position.");
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const create = useCallback(async () => {
    if (!productId || !draft.key.trim() || !Object.keys(draft.label).length || !draft.mediaKey) return;
    setSaving(true);
    try {
      await api.post(`/next-api/admin/shop/personalization/products/${productId}/placements`, {
        key: draft.key,
        label: draft.label,
        mediaKey: draft.mediaKey,
      });
      setDraft({ key: "", label: {}, mediaKey: "", url: "" });
      setAdding(false);
      await load();
    } catch {
      setError("Could not add that position. The key may already be in use.");
    } finally {
      setSaving(false);
    }
  }, [productId, draft, load]);

  const remove = useCallback(
    async (p: Placement) => {
      if (!window.confirm(`Remove "${p.label.en ?? p.key}"? Orders already placed keep their own copy.`)) return;
      setSaving(true);
      try {
        await api.delete(`/next-api/admin/shop/personalization/placements/${p.id}`);
        await load();
      } catch {
        setError("Could not remove that position.");
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Embroidery positions</h1>
      </div>
      <p className={ui.pageHint}>
        Pick a product, then set up where it can be embroidered — each position has its own name in every language,
        its own price, and a photo with the embroidery area traced on it. Customers size that area themselves.
      </p>

      {error && (
        <p className={ui.error}>
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </p>
      )}

      {/* Shop-wide, and deliberately above the product picker: the top band is
          also the hard ceiling, and a shop that turns on outline and 3D puff
          without raising it starts refusing designs that fit the panel with
          room to spare. */}
      <PriceBandEditor />

      {/* The product comes first: a position is a photograph of one product, so
          there is nothing meaningful to add or edit until one is chosen.

          A combobox rather than a <select>: a catalogue does not fit in a
          dropdown, and the admin already knows the name of the product they
          want. `personalizable` is applied server-side, so the list pages
          through exactly the products that can hold a position. */}
      <div className={ui.toolbar}>
        <ProductPicker
          value={productId}
          onChange={setProductId}
          label="Product"
          placeholder="Search products…"
          personalizable
          withThumbnails
          className={styles.productField}
        />

        {productId && (
          <button type="button" className={styles.primaryBtn} onClick={() => setAdding((v) => !v)}>
            <Plus size={14} aria-hidden="true" /> Add a position
          </button>
        )}
      </div>

      {productId && adding && (
        <div className={styles.addCard}>
          <label className={ui.field}>
            <span className={ui.label}>Key</span>
            <input
              className={ui.input}
              value={draft.key}
              onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
              placeholder="beanie-cuff"
            />
            <span className={ui.pageHint}>
              Lower-case and stable. Every stored design refers to it, so it is never renamed — the name below is what
              changes.
            </span>
          </label>

          <LocalizedTextField
            label="Name"
            hint="Shown to the customer. Write English, then Generate the rest."
            value={draft.label}
            onCommit={(label) => setDraft((d) => ({ ...d, label }))}
            translateEndpoint={TRANSLATE_TEXT}
            maxLength={120}
          />

          {/* Required at creation: a position without a photo is one a customer
              can never choose, and leaving that to a second screen is how half
              of them end up unfinished. */}
          <MediaPicker
            label="Photo"
            mediaType="image"
            value={draft.mediaKey || null}
            previewUrl={draft.url || null}
            onChange={(key, url) => setDraft((d) => ({ ...d, mediaKey: key ?? "", url: url ?? "" }))}
          />

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={create}
            disabled={saving || !draft.key.trim() || !Object.keys(draft.label).length || !draft.mediaKey}
          >
            Add position
          </button>
          {!draft.mediaKey && <p className={ui.muted}>A position needs a photo before it can be offered.</p>}
        </div>
      )}

      {!productId ? (
        <div className={ui.emptyState}>
          <Crosshair size={22} aria-hidden="true" />
          <p>Choose a product to set up where it can be embroidered.</p>
        </div>
      ) : loading ? (
        <p className={ui.muted}>Loading…</p>
      ) : !placements.length ? (
        <div className={ui.emptyState}>
          <ImageOff size={22} aria-hidden="true" />
          <p>
            No positions on this product yet. Add one — each needs a flat, evenly lit photo of this product from the
            angle that shows it.
          </p>
        </div>
      ) : (
        <div className={styles.placementList}>
          {placements.map((p) => (
            <PlacementCard
              key={p.id}
              placement={p}
              open={openId === p.id}
              onToggle={() => setOpenId((prev) => (prev === p.id ? "" : p.id))}
              onPatch={(body) => patch(p.id, body)}
              onRemove={() => remove(p)}
              saving={saving}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── One position ───────────────────────────────────────────────────────

function PlacementCard({
  placement: p,
  open,
  onToggle,
  onPatch,
  onRemove,
  saving,
}: {
  placement: Placement;
  open: boolean;
  onToggle: () => void;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onRemove: () => void;
  saving: boolean;
}) {
  const [draftQuad, setDraftQuad] = useState<Quad | null>(null);

  // A saved tracing reopens where it was left; an untraced position starts from
  // the default box so there is something to drag.
  useEffect(() => setDraftQuad(null), [p.id, p.mediaKey]);

  const savedQuad = p.isTraced ? (p.corners as Quad) : null;
  const quad = draftQuad ?? savedQuad;
  const dirty = draftQuad !== null && JSON.stringify(draftQuad) !== JSON.stringify(savedQuad);

  return (
    <article className={`${styles.placementCard} ${p.isActive ? "" : styles.placementCardOff}`}>
      <header className={styles.placementHead}>
        <div className={styles.placementIdent}>
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className={styles.placementThumb} />
          ) : (
            <span className={styles.placementThumbEmpty}>
              <ImageOff size={15} aria-hidden="true" />
            </span>
          )}
          <div>
            <strong className={styles.placementName}>{p.label.en ?? p.key}</strong>
            <span className={styles.placementSub}>
              <code className={ui.codeChip}>{p.key}</code> €{eur(p.priceCents)} · panel {p.fieldWidthMm}×{p.fieldHeightMm}mm
              {p.isTraced ? " · traced" : p.imageUrl ? " · not traced" : " · no photo"}
            </span>
          </div>
        </div>
        <div className={styles.placementHeadRight}>
          <label className={styles.activeToggle}>
            <input type="checkbox" checked={p.isActive} onChange={(e) => onPatch({ isActive: e.target.checked })} disabled={saving} />
            <span>Offered</span>
          </label>
          <button type="button" className={styles.iconBtn} onClick={onRemove} title="Remove this position">
            <Trash2 size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${open ? styles.iconBtnOpen : ""}`}
            onClick={onToggle}
            aria-expanded={open}
            title={open ? "Collapse" : "Edit"}
          >
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
      </header>

      {open && (
        <div className={styles.placementBody}>
          <LocalizedTextField
            label="Name"
            value={p.label}
            onCommit={(label) => onPatch({ label })}
            translateEndpoint={TRANSLATE_TEXT}
            maxLength={120}
          />
          <LocalizedTextField
            label="Hint"
            hint="The line under the name in the picker."
            value={p.hint ?? {}}
            onCommit={(hint) => onPatch({ hint })}
            translateEndpoint={TRANSLATE_TEXT}
            maxLength={240}
          />

          <div className={styles.numberGrid}>
            <NumberField label="Price (€)" value={p.priceCents / 100} step={0.5} onCommit={(v) => onPatch({ priceCents: Math.round(v * 100) })} />
            <NumberField label="Max colours" value={p.maxColors} onCommit={(v) => onPatch({ maxColors: Math.round(v) })} />
            <NumberField label="Max characters" value={p.maxChars} onCommit={(v) => onPatch({ maxChars: Math.round(v) })} />
          </div>

          <MediaPicker
            label="Photo"
            mediaType="image"
            value={p.mediaKey}
            previewUrl={p.imageUrl}
            onChange={(key) => onPatch({ mediaKey: key })}
          />

          {p.imageUrl ? (
            <>
              {/* The customer places text boxes freely and the hoop is fitted
                  round them. What the shop still has to say is how big the
                  panel it traced really is — that is what puts millimetres
                  onto the photograph at scale, and what bounds how far a box
                  may travel over it. */}
              <div className={styles.calibration}>
                <div className={styles.calibrationText}>
                  <strong>Real size of the traced area</strong>
                  <span>
                    Measure the panel you trace below, in millimetres. This only sets the photo&apos;s scale — the hoop is
                    fitted round whatever the customer places.
                  </span>
                </div>
                <div className={styles.calibrationFields}>
                  <NumberField label="Width (mm)" value={p.fieldWidthMm} onCommit={(v) => onPatch({ fieldWidthMm: v })} />
                  <NumberField label="Height (mm)" value={p.fieldHeightMm} onCommit={(v) => onPatch({ fieldHeightMm: v })} />
                </div>
              </div>
              <PlacementTraceEditor
                imageUrl={p.imageUrl}
                quad={quad}
                onChange={setDraftQuad}
                fieldWidthMm={p.fieldWidthMm}
                fieldHeightMm={p.fieldHeightMm}
                sampleText="Maria"
                sampleFontFamily='"Snell Roundhand", "Brush Script MT", cursive'
                disabled={saving}
              />

              <div className={styles.traceActions}>
                <span className={styles.traceStatus}>
                  {savedQuad
                    ? "Traced — the storefront draws the embroidery in perspective"
                    : "Not traced — the storefront falls back to a flat box"}
                </span>
                <div className={styles.traceButtons}>
                  {dirty && (
                    <button type="button" className={styles.ghostBtn} onClick={() => setDraftQuad(null)} disabled={saving}>
                      Revert
                    </button>
                  )}
                  {!savedQuad && !draftQuad && (
                    <button type="button" className={styles.ghostBtn} onClick={() => setDraftQuad(defaultQuad())}>
                      Start tracing
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => quad && onPatch({ corners: quad }).then(() => setDraftQuad(null))}
                    disabled={saving || !quad || !isUsableQuad(quad) || (!dirty && !!savedQuad)}
                  >
                    {saving ? <Loader2 size={14} className={styles.spin} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                    Save tracing
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className={ui.muted}>Choose a photo to trace the embroidery area on it.</p>
          )}
        </div>
      )}
    </article>
  );
}

/** A number input that only reports on blur, so typing "1" of "15" saves nothing. */
function NumberField({ label, value, step = 1, onCommit }: { label: string; value: number; step?: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className={ui.field}>
      <span className={ui.label}>{label}</span>
      <input
        className={ui.input}
        type="number"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (Number.isFinite(n) && n !== value) onCommit(n);
          else setDraft(String(value));
        }}
      />
    </label>
  );
}
