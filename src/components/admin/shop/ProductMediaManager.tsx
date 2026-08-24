"use client";

import { GripVertical, Star, Trash2, Video as VideoIcon } from "lucide-react";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import type { ProductMediaItem, ResolvedProductMediaItem } from "@/lib/shop/productContent.types";
import { useState } from "react";
import styles from "./ProductMediaManager.module.css";

interface Props {
  /** The product's gallery, already resolved with URLs (as returned by GET .../products/{id}). */
  initialMedia: ResolvedProductMediaItem[];
  onChange: (media: ProductMediaItem[]) => void;
  /** Max gallery items. Default 12. */
  maxItems?: number;
  label?: string;
}

function strip(item: ResolvedProductMediaItem): ProductMediaItem {
  return {
    key: item.key,
    type: item.type,
    posterKey: item.posterKey ?? null,
    altText: item.altText ?? null,
    isFeatured: !!item.isFeatured,
  };
}

export default function ProductMediaManager({
  initialMedia,
  onChange,
  maxItems = 12,
  label = "Product media",
}: Props) {
  const [items, setItems] = useState<ResolvedProductMediaItem[]>(initialMedia);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function notify(next: ResolvedProductMediaItem[]) {
    setItems(next);
    onChange(next.map(strip));
  }

  function updateItem(index: number, patch: Partial<ResolvedProductMediaItem>) {
    notify(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItems(assets: Array<{ storageKey: string; url: string; mediaType: "image" | "video" | "other" }>) {
    const remaining = maxItems - items.length;
    const newItems: ResolvedProductMediaItem[] = assets
      .filter((a) => a.mediaType === "image" || a.mediaType === "video")
      .filter((a) => !items.some((i) => i.key === a.storageKey))
      .slice(0, remaining)
      .map((a) => ({
        key: a.storageKey,
        type: a.mediaType === "video" ? "video" : "image",
        posterKey: null,
        posterUrl: null,
        altText: null,
        isFeatured: false,
        url: a.url,
      }));
    if (newItems.length) notify([...items, ...newItems]);
  }

  function remove(index: number) {
    notify(items.filter((_, i) => i !== index));
  }

  function setFeatured(index: number) {
    notify(items.map((item, i) => ({ ...item, isFeatured: i === index })));
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    notify(next);
  }

  const canAdd = items.length < maxItems;
  const hasExplicitFeatured = items.some((i) => i.isFeatured);
  const firstImageIndex = items.findIndex((i) => i.type === "image");

  return (
    <div>
      <p className={styles.label}>{label}</p>

      <div className={styles.grid}>
        {items.map((item, i) => {
          const isFeatured = !!item.isFeatured || (!hasExplicitFeatured && i === firstImageIndex);
          return (
            <div
              key={item.key}
              className={`${styles.card} ${dragIndex === i ? styles.cardDragging : ""}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => setDragIndex(null)}
            >
              <div className={styles.dragHandle}>
                <GripVertical size={14} />
              </div>

              <div className={styles.thumb}>
                {item.type === "video" ? (
                  <video src={item.url} className={styles.thumbImg} muted preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.altText ?? ""} className={styles.thumbImg} />
                )}
                {item.type === "video" && (
                  <div className={styles.typeBadge}>
                    <VideoIcon size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                    Video
                  </div>
                )}
              </div>

              <button
                type="button"
                className={`${styles.starBtn} ${isFeatured ? styles.starBtnActive : ""}`}
                onClick={() => setFeatured(i)}
                title={isFeatured ? "Featured media" : "Set as featured"}
              >
                <Star size={13} fill={isFeatured ? "currentColor" : "none"} />
              </button>

              <button type="button" className={styles.removeBtn} onClick={() => remove(i)} title="Remove">
                <Trash2 size={12} />
              </button>

              <div className={styles.cardBody}>
                <input
                  type="text"
                  className={styles.altInput}
                  placeholder="Alt text"
                  value={item.altText ?? ""}
                  onChange={(e) => updateItem(i, { altText: e.target.value || null })}
                />

                {item.type === "video" && (
                  <div>
                    <p className={styles.posterLabel}>Poster</p>
                    <MediaPicker
                      value={item.posterKey ?? null}
                      previewUrl={item.posterUrl}
                      mediaType="image"
                      label="Poster"
                      onChange={(key, url) => updateItem(i, { posterKey: key, posterUrl: url })}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {canAdd && <MediaPicker value={null} label="Add media" multi onSelectMulti={addItems} asAddTile />}
      </div>

      <p className={styles.hint}>
        {items.length}/{maxItems} items · drag to reorder · the star sets the featured media
      </p>
      {!canAdd && <p className={styles.maxReached}>Maximum of {maxItems} items reached.</p>}
    </div>
  );
}
