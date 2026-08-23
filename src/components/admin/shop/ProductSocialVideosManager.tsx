"use client";

import { useState } from "react";
import { GripVertical, Trash2, Eye, EyeOff, Film, Plus } from "lucide-react";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import BilingualField from "@/components/admin/BilingualField";
import { useSectionGenerate } from "@/hooks/useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import { OVERLAY_LANGS, type OverlayLang } from "@/hooks/useEntityTranslations";
import type { ProductSocialVideo } from "@/lib/shop/productContent.types";
import peStyles from "@/app/admin/shop/products/ProductEdit.module.css";
import styles from "./ProductSocialVideosManager.module.css";

const MAX_VIDEOS = 10;

/** Local-only extension of ProductSocialVideo carrying a resolved preview URL —
 *  `initialVideos` never carries one (plain jsonb shape from the backend), so
 *  pre-loaded items show MediaPicker's placeholder until the admin re-picks. */
interface LocalSocialVideo extends ProductSocialVideo {
  previewUrl?: string | null;
}

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function withPreview(item: ProductSocialVideo): LocalSocialVideo {
  const loose = item as ProductSocialVideo & { url?: string | null; posterUrl?: string | null; previewUrl?: string | null };
  return { ...item, previewUrl: loose.previewUrl ?? loose.posterUrl ?? loose.url ?? null };
}

function strip(item: LocalSocialVideo): ProductSocialVideo {
  return {
    id:        item.id,
    key:       item.key,
    title:     item.title ?? null,
    sortOrder: item.sortOrder,
    isActive:  item.isActive,
  };
}

interface Props {
  initialVideos: ProductSocialVideo[];
  translations: Record<OverlayLang, Record<string, string>>;
  onTranslationChange: (lang: OverlayLang, field: string, value: string) => void;
  onChange: (items: ProductSocialVideo[]) => void;
}

/**
 * Admin manager for the PDP "Social Videos" reels section: pick videos from
 * the media library, drag to reorder, toggle active, and give each clip an
 * optional bilingual badge caption overlaid on the storefront card.
 */
export default function ProductSocialVideosManager({ initialVideos, translations, onTranslationChange, onChange }: Props) {
  const [items, setItems] = useState<LocalSocialVideo[]>(() => initialVideos.map(withPreview));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [itemError, setItemError] = useState<{ id: string; message: string } | null>(null);
  const generator = useSectionGenerate<SectionTranslationOutcome<string>>(
    "/next-api/admin/shop/products/sections/social-videos/translate",
  );

  function notify(next: LocalSocialVideo[]) {
    const ordered = next.map((v, i) => ({ ...v, sortOrder: i }));
    setItems(ordered);
    onChange(ordered.map(strip));
  }

  function addItem(key: string, url: string | null) {
    if (items.length >= MAX_VIDEOS) return;
    const newItem: LocalSocialVideo = {
      id:         genId(),
      key,
      title:      null,
      sortOrder:  items.length,
      isActive:   true,
      previewUrl: url,
    };
    notify([...items, newItem]);
  }

  function update(index: number, patch: Partial<LocalSocialVideo>) {
    notify(items.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function remove(index: number) {
    notify(items.filter((_, i) => i !== index));
  }

  /** Reads the admin-written English badge text (stored directly on the item —
   *  the base language, never in the translations table) and asks the AI to
   *  fill in the 6 overlay languages. */
  async function generateItem(index: number) {
    const item = items[index];
    const enTitle = item.title?.trim();
    if (!enTitle) {
      setItemError({ id: item.id, message: "Write the English badge text first." });
      return;
    }
    setItemError(null);
    setGeneratingIds(prev => new Set(prev).add(item.id));
    try {
      const outcome = await generator.generate({ text: enTitle });
      if (!outcome) {
        setItemError({ id: item.id, message: "Generation failed — try again." });
        return;
      }
      OVERLAY_LANGS.forEach(lang => {
        if (outcome.result[lang]) onTranslationChange(lang, `socialVideo:${item.id}:title`, outcome.result[lang]);
      });
      const errorSummary = summarizeGenerateErrors(outcome.errors);
      if (errorSummary) setItemError({ id: item.id, message: errorSummary });
    } finally {
      setGeneratingIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    }
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    notify(next);
  }

  return (
    <div>
      {items.length === 0 && (
        <p className={styles.empty}>
          <Film size={15} />
          No social videos yet — pick vertical (9:16) clips from the media library to show a reels carousel on the product page.
        </p>
      )}

      <div className={styles.grid}>
        {items.map((item, i) => (
          <div key={item.id} className={styles.gridItem}>
            <div
              className={`${styles.tile} ${dragIndex === i ? styles.tileDragging : ""} ${!item.isActive ? styles.tileInactive : ""}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => setDragIndex(null)}
            >
              <div className={styles.tileHead}>
                <span className={styles.orderBadge}>{i + 1}</span>
                <span className={styles.dragHandle} title="Drag to reorder">
                  <GripVertical size={13} />
                </span>
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => update(i, { isActive: !item.isActive })}
                  title={item.isActive ? "Active — visible on product page" : "Inactive — hidden from product page"}
                >
                  {item.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => remove(i)}
                  title="Remove video"
                  aria-label="Remove video"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <MediaPicker
                value={item.key}
                previewUrl={item.previewUrl}
                onChange={(key, url) => update(i, { key: key ?? item.key, previewUrl: url })}
                label="video"
                mediaType="video"
              />

              {item.title?.trim() && <span className={styles.titleBadgePreview}>{item.title}</span>}
            </div>

            <div className={styles.badgeFields}>
              <BilingualField
                label="Badge"
                field={`socialVideo:${item.id}:title`}
                baseValue={item.title ?? ""}
                baseOnChange={val => update(i, { title: val })}
                basePlaceholder="Badge text (EN)"
                translations={translations}
                onTranslationChange={onTranslationChange}
                overlayPlaceholder="Badge"
                maxLength={60}
                onGenerate={() => generateItem(i)}
                generating={generatingIds.has(item.id)}
                generateError={itemError?.id === item.id ? itemError.message : null}
              />
            </div>
          </div>
        ))}

        {items.length < MAX_VIDEOS && (
          <div className={styles.addTile}>
            <span className={styles.addTileLabel}><Plus size={16} /> Add videos</span>
            <MediaPicker value={null} onChange={(key, url) => { if (key) addItem(key, url); }} label="video" mediaType="video" />
          </div>
        )}
      </div>

      <p className={peStyles.hint}>
        Drag to reorder · shown as a reels carousel above the FAQ section · {items.length}/{MAX_VIDEOS}
      </p>
    </div>
  );
}
