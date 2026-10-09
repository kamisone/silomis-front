"use client";

import { Check, ChevronDown, EyeOff, Globe, GripVertical, Lock, Star, Trash2, Video as VideoIcon } from "lucide-react";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import type { ProductMediaItem, ResolvedProductMediaItem } from "@/lib/shop/productContent.types";
import { LOCALES } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import styles from "./ProductMediaManager.module.css";

type Locale = (typeof LOCALES)[number];

/** How the admin names each storefront language. */
const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  de: "German",
  nl: "Dutch",
  pl: "Polish",
  pt: "Portuguese",
};

interface Props {
  /** The product's gallery, already resolved with URLs (as returned by GET .../products/{id}). */
  initialMedia: ResolvedProductMediaItem[];
  onChange: (media: ProductMediaItem[]) => void;
  /** Max gallery items. Default 12. */
  maxItems?: number;
  label?: string;
  /**
   * Photos that must stay in every language, keyed by storage key, with the
   * reason shown to the admin — a swatch photo, for instance. Picking "Black"
   * switches the photo in every language, so it has to exist in all of them.
   */
  lockedKeys?: Map<string, string>;
}

function limitedTo(item: ProductMediaItem): Locale[] {
  return LOCALES.filter((l) => item.locales?.includes(l));
}

function strip(item: ResolvedProductMediaItem): ProductMediaItem {
  const locales = limitedTo(item);
  return {
    key: item.key,
    type: item.type,
    posterKey: item.posterKey ?? null,
    altText: item.altText ?? null,
    isFeatured: !!item.isFeatured,
    // Every language ticked is the same as none: shared.
    locales: locales.length && locales.length < LOCALES.length ? locales : null,
  };
}

export default function ProductMediaManager({ initialMedia, onChange, maxItems = 12, label = "Product media", lockedKeys }: Props) {
  const [items, setItems] = useState<ResolvedProductMediaItem[]>(initialMedia);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /** The card whose language panel is open. */
  const [languagesFor, setLanguagesFor] = useState<string | null>(null);
  /** "all", or the language whose gallery is being previewed. */
  const [preview, setPreview] = useState<"all" | Locale>("all");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!languagesFor) return;
    const onPointerDown = (e: PointerEvent) => {
      const panel = rootRef.current?.querySelector(`[data-languages-for="${CSS.escape(languagesFor)}"]`);
      if (panel && !panel.contains(e.target as Node)) setLanguagesFor(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLanguagesFor(null);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [languagesFor]);

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

  function toggleLanguage(index: number, locale: Locale) {
    const current = new Set(limitedTo(items[index]));
    if (current.has(locale)) current.delete(locale);
    else current.add(locale);
    const next = LOCALES.filter((l) => current.has(l));
    // Ticking the last missing language is "all languages" again.
    updateItem(index, { locales: next.length === LOCALES.length ? null : next });
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
  // With no star set, the first shared photo is the face of the product —
  // the same rule the API applies (deriveLegacyImageFields).
  const implicitFeaturedIndex = items.findIndex((i) => i.type === "image" && limitedTo(i).length === 0);
  const anyLimited = items.some((i) => limitedTo(i).length > 0);

  const visibleIn = (item: ResolvedProductMediaItem, locale: Locale) => {
    const l = limitedTo(item);
    return l.length === 0 || l.includes(locale);
  };
  const previewCount = preview === "all" ? items.length : items.filter((i) => visibleIn(i, preview)).length;

  return (
    <div ref={rootRef}>
      <p className={styles.label}>{label}</p>

      {/* What one language's product page shows: the photos it does not get
          are dimmed. Only offered once a photo is limited to some languages. */}
      {items.length > 0 && (anyLimited || preview !== "all") && (
        <div className={styles.previewBar}>
          <span className={styles.previewLabel}>
            <Globe size={13} aria-hidden="true" /> Preview as
          </span>
          <div className={styles.previewChips} role="radiogroup" aria-label="Preview the gallery as a language">
            {(["all", ...LOCALES] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={preview === l}
                className={`${styles.previewChip} ${preview === l ? styles.previewChipActive : ""}`}
                onClick={() => setPreview(l)}
                title={l === "all" ? "Every photo" : `The ${LANGUAGE_NAMES[l]} product page`}
              >
                {l === "all" ? "All" : l.toUpperCase()}
              </button>
            ))}
          </div>
          {preview !== "all" && (
            <span className={styles.previewSummary}>
              {previewCount === 0
                ? `No photos for ${LANGUAGE_NAMES[preview]} — that page will show every photo instead.`
                : `${LANGUAGE_NAMES[preview]} page: ${previewCount} of ${items.length} ${items.length === 1 ? "item" : "items"}`}
            </span>
          )}
        </div>
      )}

      <div className={styles.grid}>
        {items.map((item, i) => {
          const locales = limitedTo(item);
          const limited = locales.length > 0;
          const isFeatured = !!item.isFeatured || (!hasExplicitFeatured && i === implicitFeaturedIndex);
          const lockReason = isFeatured ? "The featured photo is shown in all languages." : lockedKeys?.get(item.key);
          const hiddenInPreview = preview !== "all" && previewCount > 0 && !visibleIn(item, preview);
          const panelOpen = languagesFor === item.key;
          return (
            <div
              key={item.key}
              className={`${styles.card} ${dragIndex === i ? styles.cardDragging : ""} ${hiddenInPreview ? styles.cardHidden : ""}`}
              draggable={!panelOpen}
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
                {limited && (
                  <div className={styles.localeBadge} title={`Only on the ${locales.map((l) => LANGUAGE_NAMES[l]).join(", ")} product page`}>
                    {locales.map((l) => l.toUpperCase()).join(" · ")}
                  </div>
                )}
                {hiddenInPreview && (
                  <div className={styles.hiddenOverlay}>
                    <EyeOff size={14} aria-hidden="true" />
                    Not in {preview.toUpperCase()}
                  </div>
                )}
              </div>

              <button
                type="button"
                className={`${styles.starBtn} ${isFeatured ? styles.starBtnActive : ""}`}
                onClick={() => setFeatured(i)}
                disabled={limited}
                title={limited ? "Only a photo shown in all languages can be featured" : isFeatured ? "Featured media" : "Set as featured"}
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

                <div data-languages-for={item.key}>
                  <button
                    type="button"
                    className={`${styles.langChip} ${limited ? styles.langChipLimited : ""}`}
                    onClick={() => setLanguagesFor(panelOpen ? null : item.key)}
                    aria-expanded={panelOpen}
                    title={lockReason ?? (limited ? "Shown only in these languages" : "Shown in every language")}
                  >
                    {lockReason ? <Lock size={11} aria-hidden="true" /> : <Globe size={11} aria-hidden="true" />}
                    <span className={styles.langChipText}>{limited ? locales.map((l) => l.toUpperCase()).join(" · ") : "All languages"}</span>
                    <ChevronDown size={11} aria-hidden="true" className={panelOpen ? styles.chevronOpen : ""} />
                  </button>

                  {panelOpen && (
                    <div className={styles.langPanel} role="group" aria-label="Languages this photo is shown in">
                      {lockReason ? (
                        <p className={styles.langNote}>{lockReason}</p>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`${styles.langAll} ${!limited ? styles.langOptionOn : ""}`}
                            onClick={() => updateItem(i, { locales: null })}
                            aria-pressed={!limited}
                          >
                            {!limited && <Check size={11} aria-hidden="true" />}
                            All languages
                          </button>
                          <div className={styles.langGrid}>
                            {LOCALES.map((l) => {
                              const on = locales.includes(l);
                              return (
                                <button
                                  key={l}
                                  type="button"
                                  className={`${styles.langOption} ${on ? styles.langOptionOn : ""}`}
                                  onClick={() => toggleLanguage(i, l)}
                                  aria-pressed={on}
                                  title={LANGUAGE_NAMES[l]}
                                >
                                  {l.toUpperCase()}
                                </button>
                              );
                            })}
                          </div>
                          <p className={styles.langNote}>{limited ? "Shown only on these languages’ product pages." : "Pick languages to show this photo only on their product pages."}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

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
        {items.length}/{maxItems} items · drag to reorder · the star sets the featured media · the globe limits a photo to some languages
      </p>
      {!canAdd && <p className={styles.maxReached}>Maximum of {maxItems} items reached.</p>}
    </div>
  );
}
