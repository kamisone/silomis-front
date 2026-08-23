"use client";

import { useState } from "react";
import { GripVertical, Trash2, Eye, EyeOff } from "lucide-react";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import type { ProductZoomedImage } from "@/lib/shop/productContent.types";
import styles from "./ProductZoomedImagesManager.module.css";

/** ProductZoomedImage with resolved image URL, as returned by the admin API. */
export interface ResolvedProductZoomedImage extends ProductZoomedImage {
  url: string;
}

function strip(item: ResolvedProductZoomedImage): ProductZoomedImage {
  return {
    id: item.id,
    key: item.key,
    altText: item.altText ?? null,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
  };
}

const MAX_IMAGES = 12;

interface Props {
  initialItems: ResolvedProductZoomedImage[];
  onChange: (items: ProductZoomedImage[]) => void;
}

export default function ProductZoomedImagesManager({ initialItems, onChange }: Props) {
  const [items, setItems] = useState<ResolvedProductZoomedImage[]>(initialItems);
  const [drag, setDrag] = useState<number | null>(null);

  function notify(next: ResolvedProductZoomedImage[]) {
    const reordered = next.map((it, i) => ({ ...it, sortOrder: i }));
    setItems(reordered);
    onChange(reordered.map(strip));
  }

  function addImage(key: string, url: string) {
    if (items.length >= MAX_IMAGES) return;
    notify([...items, { id: crypto.randomUUID(), key, altText: null, sortOrder: items.length, isActive: true, url }]);
  }

  function update(index: number, patch: Partial<ResolvedProductZoomedImage>) {
    notify(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function remove(index: number) {
    notify(items.filter((_, i) => i !== index));
  }

  function handleDrop(targetIndex: number) {
    if (drag === null || drag === targetIndex) { setDrag(null); return; }
    const next = [...items];
    const [moved] = next.splice(drag, 1);
    next.splice(targetIndex, 0, moved);
    setDrag(null);
    notify(next);
  }

  return (
    <div>
      <p className={styles.note}>
        Full-bleed detail shots shown between Specifications and FAQ — each image animates from a
        close zoom down to its normal framing as a shopper scrolls to it. Image only — no text.
      </p>

      {items.length === 0 && (
        <p className={styles.empty}>No images yet. Add 3–8 close-up/detail shots for the best effect.</p>
      )}

      <div className={styles.list}>
        {items.map((item, i) => (
          <div
            key={item.id}
            className={`${styles.card} ${drag === i ? styles.cardDragging : ""} ${!item.isActive ? styles.cardInactive : ""}`}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => setDrag(null)}
          >
            <span className={styles.dragHandle}><GripVertical size={16} /></span>
            <div className={styles.mediaWrap}>
              <MediaPicker
                value={item.key}
                previewUrl={item.url}
                onChange={(key, url) => {
                  if (!key || !url) { remove(i); return; }
                  update(i, { key, url });
                }}
                label="image"
              />
            </div>
            <input
              className={styles.altInput}
              value={item.altText ?? ""}
              onChange={e => update(i, { altText: e.target.value })}
              placeholder="Alt text (accessibility)"
            />
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.eyeBtn}`}
              onClick={() => update(i, { isActive: !item.isActive })}
              title={item.isActive ? "Active — visible on product page" : "Inactive — hidden from product page"}
            >
              {item.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button type="button" className={`${styles.iconBtn} ${styles.removeIconBtn}`} onClick={() => remove(i)} title="Remove">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {items.length < MAX_IMAGES && (
        <div className={styles.addRow}>
          <MediaPicker value={null} onChange={(key, url) => { if (key && url) addImage(key, url); }} label="image" />
        </div>
      )}

      <p className={styles.hint}>
        Drag to reorder · only active images are shown on the product page · hidden automatically when empty.
      </p>
    </div>
  );
}
