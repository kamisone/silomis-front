"use client";

import { useState } from "react";
import { Gift, GripVertical, Trash2, Eye, EyeOff } from "lucide-react";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import BilingualField from "@/components/admin/BilingualField";
import { useSectionGenerate } from "@/hooks/useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import { OVERLAY_LANGS, type OverlayLang } from "@/hooks/useEntityTranslations";
import type { ProductFreeGift } from "@/lib/shop/productContent.types";
import styles from "./ProductFreeGiftsManager.module.css";

/** ProductFreeGift with its resolved image URL, as returned by the admin API. */
export interface ResolvedProductFreeGift extends ProductFreeGift {
  url: string;
}

function strip(item: ResolvedProductFreeGift): ProductFreeGift {
  return {
    id: item.id,
    key: item.key,
    label: item.label ?? null,
    valueCents: item.valueCents ?? null,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
  };
}

const MAX_GIFTS = 12;

interface Props {
  initialItems: ResolvedProductFreeGift[];
  translations: Record<OverlayLang, Record<string, string>>;
  onTranslationChange: (lang: OverlayLang, field: string, value: string) => void;
  onChange: (items: ProductFreeGift[]) => void;
}

/**
 * "Free gifts included" — a highlighted block under the Klarna line on the
 * product page. Empty means off: the section appears as soon as one active
 * gift has a photo.
 */
export default function ProductFreeGiftsManager({ initialItems, translations, onTranslationChange, onChange }: Props) {
  const [items, setItems] = useState<ResolvedProductFreeGift[]>(initialItems);
  const [drag, setDrag] = useState<number | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [itemError, setItemError] = useState<{ id: string; message: string } | null>(null);
  // The shared plain-copy route (like the articles title): a gift name needs no prompt of its own.
  const generator = useSectionGenerate<SectionTranslationOutcome<string>>("/next-api/admin/shop/translate/text");

  function notify(next: ResolvedProductFreeGift[]) {
    const reordered = next.map((it, i) => ({ ...it, sortOrder: i }));
    setItems(reordered);
    onChange(reordered.map(strip));
  }

  function addItems(assets: Array<{ storageKey: string; url: string; mediaType: "image" | "video" | "other" }>) {
    const remaining = MAX_GIFTS - items.length;
    const newItems: ResolvedProductFreeGift[] = assets
      .filter((a) => a.mediaType === "image")
      .filter((a) => !items.some((i) => i.key === a.storageKey))
      .slice(0, remaining)
      .map((a) => ({ id: crypto.randomUUID(), key: a.storageKey, label: null, valueCents: null, sortOrder: 0, isActive: true, url: a.url }));
    if (newItems.length) notify([...items, ...newItems]);
  }

  function update(index: number, patch: Partial<ResolvedProductFreeGift>) {
    notify(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function remove(index: number) {
    notify(items.filter((_, i) => i !== index));
  }

  /** Translates the English gift name (stored on the item) into the overlay languages. */
  async function generateItem(index: number) {
    const item = items[index];
    const enName = item.label?.trim();
    if (!enName) {
      setItemError({ id: item.id, message: "Write the English gift name first." });
      return;
    }
    setItemError(null);
    setGeneratingIds((prev) => new Set(prev).add(item.id));
    try {
      const outcome = await generator.generate({ text: enName });
      if (!outcome) {
        setItemError({ id: item.id, message: "Generation failed — try again." });
        return;
      }
      // A failed language comes back empty — never let it blank out a name the admin wrote.
      OVERLAY_LANGS.forEach((lang) => {
        if (outcome.result[lang]) onTranslationChange(lang, `freeGift:${item.id}:label`, outcome.result[lang]);
      });
      const errorSummary = summarizeGenerateErrors(outcome.errors);
      if (errorSummary) setItemError({ id: item.id, message: errorSummary });
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  function handleDrop(targetIndex: number) {
    if (drag === null || drag === targetIndex) {
      setDrag(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(drag, 1);
    next.splice(targetIndex, 0, moved);
    setDrag(null);
    notify(next);
  }

  const canAdd = items.length < MAX_GIFTS;
  const activeCount = items.filter((i) => i.isActive).length;

  return (
    <div>
      <p className={styles.note}>
        Photos of the gifts that come free with this product. Shown as a highlighted &quot;Free gifts included&quot; block right under the Klarna line. The section is
        on as soon as there is one active gift, and hidden when the list is empty.
      </p>

      <p className={`${styles.status} ${activeCount ? styles.statusOn : ""}`}>
        <Gift size={14} aria-hidden="true" />
        {activeCount ? `Shown on the product page · ${activeCount} gift${activeCount > 1 ? "s" : ""}` : "Not shown — add a gift photo to turn the section on"}
      </p>

      <div className={styles.list}>
        {items.map((item, i) => (
          <div
            key={item.id}
            className={`${styles.card} ${drag === i ? styles.cardDragging : ""} ${!item.isActive ? styles.cardInactive : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(i)}
          >
            <div className={styles.thumb} draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)} title="Drag to reorder">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.label ?? ""} className={styles.thumbImg} />
              <span className={styles.dragBadge}>
                <GripVertical size={13} />
              </span>
            </div>

            <div className={styles.fields}>
              <BilingualField
                label="Gift name"
                field={`freeGift:${item.id}:label`}
                baseValue={item.label ?? ""}
                baseOnChange={(val) => update(i, { label: val })}
                basePlaceholder="e.g. Matching drawstring bag"
                overlayPlaceholder="e.g. Pochon assorti"
                maxLength={200}
                translations={translations}
                onTranslationChange={onTranslationChange}
                onGenerate={() => generateItem(i)}
                generating={generatingIds.has(item.id)}
                generateError={itemError?.id === item.id ? itemError.message : null}
              />
              <label className={styles.valueField}>
                <span className={styles.valueLabel}>Value on its own (optional) — shown struck through next to &quot;Free&quot;</span>
                <span className={styles.valueInputWrap}>
                  <input
                    className={styles.valueInput}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={item.valueCents != null ? (item.valueCents / 100).toString() : ""}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value.replace(",", "."));
                      update(i, { valueCents: Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null });
                    }}
                    placeholder="9.90"
                  />
                  <span className={styles.valueSuffix}>€</span>
                </span>
              </label>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => update(i, { isActive: !item.isActive })}
                title={item.isActive ? "Shown — click to hide from the product page" : "Hidden — click to show on the product page"}
              >
                {item.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button type="button" className={`${styles.iconBtn} ${styles.removeBtn}`} onClick={() => remove(i)} title="Remove">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {canAdd && (
        <div className={styles.addRow}>
          <MediaPicker value={null} label="gift photo" mediaType="image" multi onSelectMulti={addItems} asAddTile />
        </div>
      )}

      <p className={styles.hint}>Drag a photo to reorder · square photos on a plain background look best.</p>
      {!canAdd && <p className={styles.hint}>Maximum of {MAX_GIFTS} gifts reached.</p>}
    </div>
  );
}
