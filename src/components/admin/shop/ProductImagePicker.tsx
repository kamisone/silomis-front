"use client";

import Modal from "@/components/admin/ui/Modal";
import type { ResolvedProductMediaItem } from "@/lib/shop/productContent.types";
import styles from "./ProductImagePicker.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  /** This product's own gallery — videos should be filtered out by the caller before passing in. */
  images: ResolvedProductMediaItem[];
  onSelect: (item: ResolvedProductMediaItem) => void;
  title?: string;
}

/** Restricted picker for per-variant swatch images — only offers this product's own gallery, not the full media library. */
export default function ProductImagePicker({ open, onClose, images, onSelect, title = "Select image" }: Props) {
  if (!open) return null;

  return (
    <Modal title={title} onClose={onClose}>
      {images.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No images in this product&apos;s gallery yet</div>
          <div className={styles.emptyHint}>Add images via &quot;Product media&quot; first.</div>
        </div>
      ) : (
        <div className={styles.grid}>
          {images.map((item) => (
            <div
              key={item.key}
              className={styles.gridItem}
              onClick={() => onSelect(item)}
              title={item.altText ?? undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.altText ?? ""} className={styles.gridImg} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
