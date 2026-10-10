"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, AlertTriangle, ImageOff, ChevronDown, Crosshair, Palette } from "lucide-react";
import { api } from "@/lib/api";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import ProductPicker from "@/components/admin/shop/ProductPicker";
import LocalizedTextField, { type LocalizedTextMap } from "@/components/admin/ui/LocalizedTextField";
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
  priceCents: number;
  isActive: boolean;
  sortOrder: number;
  mediaKey: string | null;
  imageUrl: string | null;
  corners: { x: number; y: number }[];
  /** This position photographed per variation option (the black cap's front panel). */
  optionImages: { optionValueId: string; mediaKey: string; imageUrl: string | null }[];
}

/** One of the product's variation attributes, with the values its variants use. */
interface VariationOptions {
  attributeId: string;
  name: string;
  adminLabel: string | null;
  values: { id: string; value: string; displayValue: string | null; swatchType: "color" | "image" | null; swatchValue: string | null }[];
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
  const [variationOptions, setVariationOptions] = useState<VariationOptions[]>([]);
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
      const [list, options] = await Promise.all([
        api.get<Placement[]>(`/next-api/admin/shop/personalization/products/${productId}/placements`),
        api.get<VariationOptions[]>(`/next-api/admin/shop/personalization/products/${productId}/placement-options`).catch(() => []),
      ]);
      setPlacements(list);
      setVariationOptions(options);
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

  /** Sets (or, with null, removes) a position's photo for one variation option. */
  const setOptionPhoto = useCallback(
    async (placementId: string, optionValueId: string, mediaKey: string | null) => {
      setSaving(true);
      setError("");
      try {
        const url = `/next-api/admin/shop/personalization/placements/${placementId}/option-images/${optionValueId}`;
        if (mediaKey) await api.put(url, { mediaKey });
        else await api.delete(url);
        await load();
      } catch {
        setError("Could not save that option photo.");
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
              variationOptions={variationOptions}
              onOptionPhoto={(optionValueId, mediaKey) => setOptionPhoto(p.id, optionValueId, mediaKey)}
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
  variationOptions,
  onOptionPhoto,
}: {
  placement: Placement;
  open: boolean;
  onToggle: () => void;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onRemove: () => void;
  saving: boolean;
  variationOptions: VariationOptions[];
  onOptionPhoto: (optionValueId: string, mediaKey: string | null) => Promise<void>;
}) {
  const optionPhotoCount = p.optionImages?.length ?? 0;
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
              <code className={ui.codeChip}>{p.key}</code> €{eur(p.priceCents)}
              {p.imageUrl ? "" : " · no photo — not offered"}
              {optionPhotoCount > 0 && ` · ${optionPhotoCount} option ${optionPhotoCount === 1 ? "photo" : "photos"}`}
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
          </div>

          <MediaPicker
            label="Photo"
            mediaType="image"
            value={p.mediaKey}
            previewUrl={p.imageUrl}
            onChange={(key) => onPatch({ mediaKey: key })}
          />

          {!p.imageUrl && <p className={ui.muted}>A position needs a photo before it can be offered.</p>}

          <OptionPhotos placement={p} variationOptions={variationOptions} onOptionPhoto={onOptionPhoto} saving={saving} />
        </div>
      )}
    </article>
  );
}

// ── Photos per variation option ────────────────────────────────────────

/**
 * The same view of the product in each option — the black cap's front panel
 * beside the red one's.
 *
 * Customers left the editor when it showed a cap in another colour than the
 * one they had picked: they read it as their choice being changed. A photo set
 * here replaces the position's photo above whenever the customer's variant
 * has that option; options left empty keep the photo above. One tile per
 * option, grouped by attribute in the product's order — colour first for most
 * products, though any attribute works, and where a variant matches photos in
 * two attributes the one listed first wins.
 */
function OptionPhotos({
  placement: p,
  variationOptions,
  onOptionPhoto,
  saving,
}: {
  placement: Placement;
  variationOptions: VariationOptions[];
  onOptionPhoto: (optionValueId: string, mediaKey: string | null) => Promise<void>;
  saving: boolean;
}) {
  const byOption = new Map((p.optionImages ?? []).map((i) => [i.optionValueId, i]));

  return (
    <section className={styles.optionPhotos} aria-labelledby={`opt-photos-${p.id}`}>
      <div className={styles.optionPhotosHead}>
        <h3 id={`opt-photos-${p.id}`} className={styles.optionPhotosTitle}>
          <Palette size={14} aria-hidden="true" /> Photo per option
        </h3>
        <p className={styles.optionPhotosHint}>
          The same view of the product in each colour (or any option). The customer sees the photo of the option they
          chose; an option without one shows the photo above. Frame each like the photo above — the embroidery area is
          the same.
        </p>
      </div>

      {!variationOptions.length ? (
        <p className={ui.muted}>This product has no variation options, so the photo above is used for everything.</p>
      ) : (
        variationOptions.map((attr) => {
          const filled = attr.values.filter((v) => byOption.has(v.id)).length;
          return (
            <div key={attr.attributeId} className={styles.optionGroup}>
              <p className={styles.optionGroupName}>
                {attr.name}
                {attr.adminLabel && <span className={styles.optionGroupAdmin}> — {attr.adminLabel}</span>}
                <span className={styles.optionGroupCount}>
                  {filled} of {attr.values.length} with a photo
                </span>
              </p>
              <div className={styles.optionGrid}>
                {attr.values.map((v) => {
                  const img = byOption.get(v.id);
                  const name = v.displayValue ?? v.value;
                  return (
                    <div key={v.id} className={`${styles.optionTile} ${saving ? styles.optionTileBusy : ""}`}>
                      <MediaPicker
                        asAddTile
                        label={name}
                        mediaType="image"
                        value={img?.mediaKey ?? null}
                        previewUrl={img?.imageUrl ?? null}
                        onChange={(key) => void onOptionPhoto(v.id, key)}
                      />
                      <span className={styles.optionName}>
                        {v.swatchType === "color" && v.swatchValue && (
                          <span className={styles.optionSwatch} style={{ background: v.swatchValue }} aria-hidden="true" />
                        )}
                        <span className={styles.optionNameText}>{name}</span>
                      </span>
                      {!img && <span className={styles.optionFallback}>Uses the photo above</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </section>
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
