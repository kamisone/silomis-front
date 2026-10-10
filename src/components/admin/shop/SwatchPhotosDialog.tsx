"use client";

import { useState } from "react";
import { Check, Globe, ImageOff, Loader2, RotateCcw } from "lucide-react";
import Modal from "@/components/admin/ui/Modal";
import type { ResolvedProductMediaItem } from "@/lib/shop/productContent.types";
import { LANGUAGE_NAMES, STOREFRONT_LOCALES, shownIn, type StorefrontLocale } from "./storefrontLanguages";
import styles from "./SwatchPhotosDialog.module.css";

/** One stored swatch photo: the default (`locale` null) or one language's. */
export interface SwatchPhoto {
  optionValueId: string;
  locale: string | null;
  mediaKey: string;
  url: string | null;
}

interface Props {
  /** "Black" — what the dialog is about. */
  optionName: string;
  /** This option's photos: at most one default and one per language. */
  photos: SwatchPhoto[];
  /** The product's gallery, as currently edited — what can be picked from. */
  gallery: ResolvedProductMediaItem[];
  onSet: (locale: StorefrontLocale | null, mediaKey: string) => Promise<void>;
  onRemove: (locale: StorefrontLocale | null) => Promise<void>;
  onClose: () => void;
}

/** "default" or a language: the row a picker is open under. */
type Slot = "default" | StorefrontLocale;

/**
 * An image swatch's photos: the default every language shows, and optional
 * photos for single languages — a cap shot with French packaging for France.
 *
 * Each picker only offers photos that row's language actually shows: the
 * default from photos in every language (it is everyone's fallback, and what
 * the cart and share previews of any language use), a language's photo from
 * what that language's gallery shows. The API applies the same rules; this
 * keeps the admin from picking something it would refuse.
 */
export default function SwatchPhotosDialog({ optionName, photos, gallery, onSet, onRemove, onClose }: Props) {
  const [picking, setPicking] = useState<Slot | null>(null);
  const [busy, setBusy] = useState<Slot | null>(null);

  const images = gallery.filter((m) => m.type === "image");
  const defaultPhoto = photos.find((p) => !p.locale) ?? null;
  const languagePhoto = (l: StorefrontLocale) => photos.find((p) => p.locale === l) ?? null;
  const languageCount = photos.filter((p) => p.locale).length;

  const eligible = (slot: Slot) => (slot === "default" ? images.filter((m) => !m.locales?.length) : images.filter((m) => shownIn(m.locales, slot)));

  async function run(slot: Slot, action: () => Promise<void>) {
    setBusy(slot);
    try {
      await action();
      setPicking(null);
    } finally {
      setBusy(null);
    }
  }

  function choose(slot: Slot, mediaKey: string) {
    return run(slot, () => onSet(slot === "default" ? null : slot, mediaKey));
  }

  function removeDefault() {
    if (languageCount > 0 && !window.confirm(`Remove the default photo? The ${languageCount} language ${languageCount === 1 ? "photo goes" : "photos go"} with it — they have nothing to fall back from.`)) return;
    return run("default", () => onRemove(null));
  }

  function picker(slot: Slot, currentKey: string | null) {
    const options = eligible(slot);
    return (
      <div className={styles.picker}>
        {options.length === 0 ? (
          <p className={styles.pickerEmpty}>
            {slot === "default"
              ? "No photo in the gallery is shown in every language. Add one, or set one to “All languages” in Product media."
              : `No photo in the gallery is shown in ${LANGUAGE_NAMES[slot]}. Add one, or include ${slot.toUpperCase()} in a photo's languages in Product media.`}
          </p>
        ) : (
          <div className={styles.pickerGrid} role="listbox" aria-label={`Photos for ${slot === "default" ? "the default" : LANGUAGE_NAMES[slot]}`}>
            {options.map((m) => {
              const selected = m.key === currentKey;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`${styles.pickerItem} ${selected ? styles.pickerItemSelected : ""}`}
                  onClick={() => (selected ? setPicking(null) : choose(slot, m.key))}
                  disabled={busy !== null}
                  title={m.altText ?? undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.altText ?? ""} />
                  {m.locales?.length ? <span className={styles.pickerLocales}>{m.locales.map((l) => l.toUpperCase()).join(" · ")}</span> : null}
                  {selected && (
                    <span className={styles.pickerCheck}>
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <button type="button" className={styles.linkBtn} onClick={() => setPicking(null)}>
          Cancel
        </button>
      </div>
    );
  }

  function thumb(url: string | null | undefined, faded = false) {
    return url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={`${styles.thumb} ${faded ? styles.thumbFaded : ""}`} />
    ) : (
      <span className={`${styles.thumb} ${styles.thumbEmpty}`}>
        <ImageOff size={16} aria-hidden="true" />
      </span>
    );
  }

  return (
    <Modal title={`Swatch photos — ${optionName}`} onClose={onClose} maxWidth={680}>
      <p className={styles.intro}>
        The default photo shows in every language. Give a language its own photo to show a different shot on that
        language’s pages — packaging with local text, for instance. Each list only offers photos that language’s gallery
        shows.
      </p>

      {/* ── Default ── */}
      <section className={styles.row}>
        {thumb(defaultPhoto?.url)}
        <div className={styles.rowText}>
          <span className={styles.rowTitle}>
            <Globe size={13} aria-hidden="true" /> Default
          </span>
          <span className={styles.rowSub}>{defaultPhoto ? "Every language without its own photo" : "Not set — this swatch shows no photo"}</span>
        </div>
        <div className={styles.rowActions}>
          {busy === "default" && <Loader2 size={14} className={styles.spin} aria-label="Saving" />}
          <button type="button" className={styles.btn} onClick={() => setPicking(picking === "default" ? null : "default")} disabled={busy !== null} aria-expanded={picking === "default"}>
            {defaultPhoto ? "Change" : "Choose photo"}
          </button>
          {defaultPhoto && (
            <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={removeDefault} disabled={busy !== null}>
              Remove
            </button>
          )}
        </div>
      </section>
      {picking === "default" && picker("default", defaultPhoto?.mediaKey ?? null)}

      {/* ── Per language ── */}
      <p className={styles.groupLabel}>
        Per language
        <span className={styles.groupCount}>{languageCount ? `${languageCount} of ${STOREFRONT_LOCALES.length} with their own photo` : "All use the default"}</span>
      </p>
      {!defaultPhoto && <p className={styles.notice}>Set the default photo first — a language photo replaces it, and the other languages need it.</p>}

      <div className={styles.languageList}>
        {STOREFRONT_LOCALES.map((l) => {
          const own = languagePhoto(l);
          return (
            <div key={l} className={styles.languageBlock}>
              <section className={`${styles.row} ${styles.rowCompact} ${own ? styles.rowOwn : ""}`}>
                {thumb(own?.url ?? defaultPhoto?.url, !own)}
                <div className={styles.rowText}>
                  <span className={styles.rowTitle}>
                    <span className={styles.code}>{l.toUpperCase()}</span> {LANGUAGE_NAMES[l]}
                  </span>
                  <span className={styles.rowSub}>{own ? "Its own photo" : "Uses the default"}</span>
                </div>
                <div className={styles.rowActions}>
                  {busy === l && <Loader2 size={14} className={styles.spin} aria-label="Saving" />}
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => setPicking(picking === l ? null : l)}
                    disabled={busy !== null || !defaultPhoto}
                    aria-expanded={picking === l}
                  >
                    {own ? "Change" : "Set photo"}
                  </button>
                  {own && (
                    <button type="button" className={styles.btn} onClick={() => run(l, () => onRemove(l))} disabled={busy !== null} title="Use the default photo again">
                      <RotateCcw size={12} aria-hidden="true" /> Default
                    </button>
                  )}
                </div>
              </section>
              {picking === l && picker(l, own?.mediaKey ?? null)}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
