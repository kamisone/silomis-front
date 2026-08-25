"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import ImageLightbox from "@/components/shop/ImageLightbox";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./ProductDetail.module.css";

interface PackageContentItem {
  id: string;
  label?: string | null;
  url: string;
  isActive?: boolean;
}

interface Props {
  locale: Locale;
  items: PackageContentItem[];
}

/** "What's in the box" — a collapsible section right after Delivery details,
 *  showing one thumbnail per included item. Clicking a thumbnail opens it
 *  full-size in the shared ImageLightbox. */
export default function PackageContents({ locale, items }: Props) {
  const t = getTranslations(locale).shop;
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const active = items.filter((i) => i.isActive !== false && i.url);

  if (!active.length) return null;

  return (
    <>
      <details className={styles.packageSection}>
        <summary className={styles.packageToggle}>
          <span className={styles.packageToggleLabel}>
            <Package size={16} className={styles.packageToggleIcon} aria-hidden="true" />
            {t.packageContentsTitle}
          </span>
          <span className={styles.packageChevron} aria-hidden="true" />
        </summary>

        <div className={styles.packageBody}>
          <div className={styles.packageGrid}>
            {active.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={styles.packageItem}
                onClick={() => setOpenIndex(i)}
                aria-label={item.label?.trim() || t.packageContentsTitle}
              >
                <span className={styles.packageThumb}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="" loading="lazy" decoding="async" draggable={false} className={styles.packageThumbImg} />
                </span>
                {item.label?.trim() && <span className={styles.packageLabel}>{item.label}</span>}
              </button>
            ))}
          </div>
        </div>
      </details>

      {openIndex !== null && (
        <ImageLightbox
          images={active.map((item) => ({ id: item.id, url: item.url, title: item.label ?? undefined }))}
          initialIndex={openIndex}
          onClose={() => setOpenIndex(null)}
          ariaLabel={t.packageContentsTitle}
        />
      )}
    </>
  );
}
