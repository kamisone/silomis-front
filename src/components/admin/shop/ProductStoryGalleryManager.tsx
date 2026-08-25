"use client";

import { useState } from "react";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import BilingualField from "@/components/admin/BilingualField";
import SectionGenerateButton from "@/components/admin/SectionGenerateButton";
import { useSectionGenerate } from "@/hooks/useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import { OVERLAY_LANGS, type OverlayLang } from "@/hooks/useEntityTranslations";
import type { ProductStoryItem, StoryGalleryLocation, StoryImageAspectRatio } from "@/lib/shop/productContent.types";
import { GripVertical, Trash2, Eye, EyeOff, PanelRight, BookOpen } from "lucide-react";
import peStyles from "@/app/admin/shop/products/ProductEdit.module.css";
import styles from "./ProductStoryGalleryManager.module.css";

const ASPECT_RATIO_OPTIONS: Array<{ value: StoryImageAspectRatio; label: string }> = [
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

const MAX_PER_LOCATION = 8;

/** Local-only extension of ProductStoryItem carrying a resolved image URL for
 *  the thumbnail preview. `initialItems` never carries a URL (it's the plain
 *  jsonb shape from the backend), so pre-loaded items fall back gracefully —
 *  MediaPicker renders a "no image" placeholder until the admin picks/repicks
 *  one, at which point we capture the URL locally from its onChange. */
interface LocalStoryItem extends ProductStoryItem {
  previewUrl?: string | null;
}

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function withPreview(item: ProductStoryItem): LocalStoryItem {
  const loose = item as ProductStoryItem & { url?: string | null; previewUrl?: string | null };
  return { ...item, previewUrl: loose.previewUrl ?? loose.url ?? null };
}

function strip(item: LocalStoryItem): ProductStoryItem {
  return {
    id:          item.id,
    key:         item.key,
    location:    item.location,
    altText:     item.altText ?? null,
    aspectRatio: item.aspectRatio,
    title:       item.title,
    description: item.description,
    sortOrder:   item.sortOrder,
    isActive:    item.isActive,
  };
}

interface Props {
  initialItems: ProductStoryItem[];
  translations: Record<OverlayLang, Record<string, string>>;
  onTranslationChange: (lang: OverlayLang, field: string, value: string) => void;
  onChange: (items: ProductStoryItem[]) => void;
}

export default function ProductStoryGalleryManager({ initialItems, translations, onTranslationChange, onChange }: Props) {
  const [items, setItems] = useState<LocalStoryItem[]>(() => initialItems.map(withPreview));
  const [drag, setDrag] = useState<{ location: StoryGalleryLocation; index: number } | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [itemError, setItemError] = useState<{ id: string; message: string } | null>(null);
  const generator = useSectionGenerate<SectionTranslationOutcome<{ title: string; description: string }>>(
    "/next-api/admin/shop/products/sections/story-items/translate",
  );

  const side      = items.filter(i => i.location === "side");
  const narrative = items.filter(i => i.location === "narrative");

  function notify(nextSide: LocalStoryItem[], nextNarrative: LocalStoryItem[]) {
    const next = [
      ...nextSide.map((s, i) => ({ ...s, sortOrder: i })),
      ...nextNarrative.map((s, i) => ({ ...s, sortOrder: i })),
    ];
    setItems(next);
    onChange(next.map(strip));
  }

  function withUpdated(location: StoryGalleryLocation, sub: LocalStoryItem[]) {
    if (location === "side") notify(sub, narrative);
    else notify(side, sub);
  }

  function addItems(location: StoryGalleryLocation, assets: Array<{ storageKey: string; url: string; mediaType: "image" | "video" | "other" }>) {
    const sub = location === "side" ? side : narrative;
    const remaining = MAX_PER_LOCATION - sub.length;
    const newItems: LocalStoryItem[] = assets
      .filter((a) => a.mediaType === "image")
      .filter((a) => !sub.some((i) => i.key === a.storageKey))
      .slice(0, remaining)
      .map((a) => ({
        id: genId(),
        key: a.storageKey,
        location,
        altText: null,
        aspectRatio: "1:1",
        title: "",
        description: "",
        sortOrder: sub.length,
        isActive: true,
        previewUrl: a.url,
      }));
    if (newItems.length) withUpdated(location, [...sub, ...newItems]);
  }

  function update(location: StoryGalleryLocation, index: number, patch: Partial<LocalStoryItem>) {
    const sub = location === "side" ? side : narrative;
    withUpdated(location, sub.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function remove(location: StoryGalleryLocation, index: number) {
    const sub = location === "side" ? side : narrative;
    withUpdated(location, sub.filter((_, i) => i !== index));
  }

  /** Reads the admin-written English title/description for this story block (stored
   *  directly on the item — the base language, never in the translations table)
   *  and asks the AI to fill in the 6 overlay languages. */
  async function generateItem(index: number) {
    const item = narrative[index];
    const enTitle = item.title?.trim();
    const enDescription = item.description?.trim();
    if (!enTitle || !enDescription) {
      setItemError({ id: item.id, message: "Write the English title and description first." });
      return;
    }
    setItemError(null);
    setGeneratingIds(prev => new Set(prev).add(item.id));
    try {
      const outcome = await generator.generate({ title: enTitle, description: enDescription });
      if (!outcome) {
        setItemError({ id: item.id, message: "Generation failed — try again." });
        return;
      }
      OVERLAY_LANGS.forEach(lang => {
        if (outcome.result[lang].title) onTranslationChange(lang, `storyItem:${item.id}:title`, outcome.result[lang].title);
        if (outcome.result[lang].description) onTranslationChange(lang, `storyItem:${item.id}:description`, outcome.result[lang].description);
      });
      const errorSummary = summarizeGenerateErrors(outcome.errors);
      if (errorSummary) setItemError({ id: item.id, message: errorSummary });
    } finally {
      setGeneratingIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    }
  }

  function handleDrop(location: StoryGalleryLocation, targetIndex: number) {
    if (!drag || drag.location !== location || drag.index === targetIndex) { setDrag(null); return; }
    const sub = [...(location === "side" ? side : narrative)];
    const [moved] = sub.splice(drag.index, 1);
    sub.splice(targetIndex, 0, moved);
    setDrag(null);
    withUpdated(location, sub);
  }

  function dragProps(location: StoryGalleryLocation, index: number) {
    return {
      draggable: true,
      onDragStart: () => setDrag({ location, index }),
      onDragOver: (e: React.DragEvent) => e.preventDefault(),
      onDrop: () => handleDrop(location, index),
      onDragEnd: () => setDrag(null),
    };
  }

  return (
    <div>
      {/* ── Location 1: Creative Side Gallery ── */}
      <div className={styles.locationHead}>
        <span className={styles.locationIcon}><PanelRight size={14} strokeWidth={1.75} /></span>
        <div>
          <div className={styles.locationTitle}>Creative Side Gallery <span className={styles.locationTag}>Location 1</span></div>
          <div className={styles.locationNote}>Artistic image composition displayed next to the FAQ section. Images only — no text.</div>
        </div>
      </div>

      {side.length === 0 && (
        <p className={styles.empty}>No images yet. Add 2–5 images for the best composition.</p>
      )}

      <div className={styles.sideGrid}>
        {side.map((item, i) => (
          <div
            key={item.id}
            className={`${styles.sideCard} ${drag?.location === "side" && drag.index === i ? styles.cardDragging : ""} ${!item.isActive ? styles.cardInactive : ""}`}
          >
            <div className={styles.sideThumb} {...dragProps("side", i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl ?? undefined} alt={item.altText ?? ""} className={styles.thumbImg} />
              <span className={styles.dragBadge}><GripVertical size={13} /></span>
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.eyeBtn}`}
                onClick={() => update("side", i, { isActive: !item.isActive })}
                title={item.isActive ? "Active — visible on product page" : "Inactive — hidden from product page"}
              >
                {item.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <button type="button" className={`${styles.iconBtn} ${styles.removeIconBtn}`} onClick={() => remove("side", i)} title="Remove">
                <Trash2 size={13} />
              </button>
            </div>
            <input
              className={styles.altInput}
              value={item.altText ?? ""}
              onChange={e => update("side", i, { altText: e.target.value })}
              placeholder="Alt text (accessibility)"
            />
          </div>
        ))}

        {side.length < MAX_PER_LOCATION && (
          <MediaPicker value={null} label="image" mediaType="image" multi onSelectMulti={(assets) => addItems("side", assets)} asAddTile className={styles.addTile} />
        )}
      </div>

      <div className={peStyles.divider} />

      {/* ── Location 2: Narrative Gallery ── */}
      <div className={styles.locationHead}>
        <span className={styles.locationIcon}><BookOpen size={14} strokeWidth={1.75} /></span>
        <div>
          <div className={styles.locationTitle}>Narrative Gallery <span className={styles.locationTag}>Location 2</span></div>
          <div className={styles.locationNote}>Storytelling section displayed after all product sections. Each image is paired with a localized title and description.</div>
        </div>
      </div>

      {narrative.length === 0 && (
        <p className={styles.empty}>No story blocks yet. Add images with a title and description to tell the product&apos;s story.</p>
      )}

      <div className={styles.narrativeList}>
        {narrative.map((item, i) => (
          <div
            key={item.id}
            className={`${styles.narrativeCard} ${drag?.location === "narrative" && drag.index === i ? styles.cardDragging : ""} ${!item.isActive ? styles.cardInactive : ""}`}
          >
            <div className={styles.narrativeHead} {...dragProps("narrative", i)}>
              <span className={styles.dragHandle}><GripVertical size={16} /></span>
              <span className={styles.narrativeTitle}>Story block {i + 1}</span>
              <SectionGenerateButton
                onClick={() => generateItem(i)}
                generating={generatingIds.has(item.id)}
                title="Write the English title/description first, then generate the other languages"
              />
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => update("narrative", i, { isActive: !item.isActive })}
                title={item.isActive ? "Active — visible on product page" : "Inactive — hidden from product page"}
              >
                {item.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                {item.isActive ? "Active" : "Inactive"}
              </button>
              <button type="button" className={styles.removeBtn} onClick={() => remove("narrative", i)} title="Remove">
                <Trash2 size={15} />
              </button>
            </div>

            {itemError?.id === item.id && (
              <p className={styles.itemError}>{itemError.message}</p>
            )}

            <div className={styles.narrativeBody}>
              <div className={styles.narrativeThumbCol}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl ?? undefined} alt={item.altText ?? ""} className={styles.narrativeThumb} />
                <input
                  className={styles.altInput}
                  value={item.altText ?? ""}
                  onChange={e => update("narrative", i, { altText: e.target.value })}
                  placeholder="Alt text (accessibility)"
                />
                <p className={styles.ratioLabel}>Display ratio</p>
                <div className={styles.ratioGroup}>
                  {ASPECT_RATIO_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`${styles.ratioBtn} ${item.aspectRatio === opt.value ? styles.ratioBtnActive : ""}`}
                      onClick={() => update("narrative", i, { aspectRatio: opt.value })}
                      title={`Show this image at a ${opt.label} ratio on the product page`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.narrativeFields}>
                <BilingualField
                  label="Title"
                  field={`storyItem:${item.id}:title`}
                  baseValue={item.title}
                  baseOnChange={val => update("narrative", i, { title: val })}
                  basePlaceholder="e.g. Designed for the road"
                  baseRequired
                  translations={translations}
                  onTranslationChange={onTranslationChange}
                  overlayPlaceholder="e.g. Pensé pour la route"
                />
                <BilingualField
                  label="Description"
                  field={`storyItem:${item.id}:description`}
                  baseValue={item.description}
                  baseOnChange={val => update("narrative", i, { description: val })}
                  basePlaceholder="Tell the story behind this image…"
                  multiline
                  rows={3}
                  translations={translations}
                  onTranslationChange={onTranslationChange}
                  overlayPlaceholder="Racontez l'histoire derrière cette image…"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {narrative.length < MAX_PER_LOCATION && (
        <MediaPicker
          value={null}
          label="Add story block"
          mediaType="image"
          multi
          onSelectMulti={(assets) => addItems("narrative", assets)}
          asAddTile
          className={styles.addBtnTile}
        />
      )}

      <p className={peStyles.hint}>
        Drag to reorder within each location · only active items are shown on the product page · sections with no items are hidden automatically.
      </p>
    </div>
  );
}
