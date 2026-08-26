"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Languages, Trash2 } from "lucide-react";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import LocalizedTextField, { type LocalizedTextMap } from "@/components/admin/ui/LocalizedTextField";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { useLocalizedEntity } from "@/hooks/useLocalizedEntity";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";
import SlidePreview from "./SlidePreview";
import styles from "./HeroSlides.module.css";

export interface HeroSlide {
  id: string;
  sortOrder: number;
  isActive: boolean;
  imageKey: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryHref: string | null;
}

/** Copy fields: written in English on the slide itself, then in six more
 *  languages as translation rows. */
type LocalizedField = "imageAlt" | "eyebrow" | "title" | "subtitle" | "ctaLabel" | "ctaSecondaryLabel";

/** Links are addresses, not copy — the same path serves every language. */
type PlainField = "ctaHref" | "ctaSecondaryHref";

/** The storefront reads slide overlays under this entity type — see
 *  HeroSlidesService.publicList. */
const ENTITY_TYPE = "shop_home_hero_slide";

const TRANSLATE_TEXT = "/next-api/admin/shop/hero-slides/sections/text/translate";

/**
 * One slide in the hero rotation.
 *
 * Its own component because each slide needs its own translation rows loaded,
 * and hooks can't be called from inside the page's map(). The card keeps a
 * draft of the English copy so the preview follows what is being typed, while
 * every field saves itself as the editor leaves it.
 */
export default function SlideCard({
  slide,
  index,
  total,
  saving,
  onPatch,
  onMove,
  onDelete,
  onError,
}: {
  slide: HeroSlide;
  index: number;
  total: number;
  saving: boolean;
  onPatch: (id: string, body: Partial<HeroSlide>) => Promise<void>;
  onMove: (index: number, delta: -1 | 1) => void;
  onDelete: (slide: HeroSlide) => void;
  onError: (message: string) => void;
}) {
  const { mapFor, saveField } = useLocalizedEntity(ENTITY_TYPE, slide.id);
  // Unsaved English keystrokes. Lets the preview follow what is being typed
  // instead of lagging a round-trip behind.
  const [draft, setDraft] = useState<Partial<HeroSlide>>({});

  const view = { ...slide, ...draft };
  const dirty = Object.keys(draft).length > 0;

  function clearDraft(field: keyof HeroSlide) {
    setDraft((d) => {
      if (!(field in d)) return d;
      const rest = { ...d };
      delete rest[field];
      return rest;
    });
  }

  /** English lands on the slide, the other six become translation rows. Both
   *  only when they actually changed, so tabbing through a slide doesn't fire
   *  a dozen pointless requests. */
  async function commitLocalized(field: LocalizedField, map: LocalizedTextMap) {
    const base = map[DEFAULT_LOCALE]?.trim() ?? "";
    if (field === "title" && !base) {
      onError("A slide needs a title");
      clearDraft("title");
      return;
    }
    setDraft((d) => ({ ...d, [field]: base || null }));
    try {
      if (base !== ((slide[field] as string | null) ?? "")) {
        await onPatch(slide.id, { [field]: base || null } as Partial<HeroSlide>);
      }
      await saveField(field, map);
    } catch {
      onError("Failed to save the slide's translations");
    } finally {
      clearDraft(field);
    }
  }

  function commitPlain(field: PlainField, raw: string) {
    const value = raw.trim();
    if (value === ((slide[field] as string | null) ?? "")) return;
    onPatch(slide.id, { [field]: value || null } as Partial<HeroSlide>);
  }

  // How much of this slide exists beyond English — the one thing the card
  // header can say about seven languages in the space of a pill.
  const translatedLangs = LOCALES.filter(
    (l) => l !== DEFAULT_LOCALE && (["eyebrow", "title", "subtitle", "ctaLabel", "ctaSecondaryLabel"] as const).some(
      (f) => mapFor(f, null)[l]?.trim(),
    ),
  );

  return (
    <li className={`${styles.card} ${slide.isActive ? "" : styles.cardOff}`}>
      {/* Position rail: the number is the play order, the arrows move it. */}
      <div className={styles.rail}>
        <span className={styles.railNum}>{index + 1}</span>
        <button
          type="button"
          className={styles.moveBtn}
          onClick={() => onMove(index, -1)}
          disabled={index === 0 || saving}
          aria-label={`Move slide ${index + 1} earlier`}
        >
          <ArrowUp size={13} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className={styles.moveBtn}
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1 || saving}
          aria-label={`Move slide ${index + 1} later`}
        >
          <ArrowDown size={13} strokeWidth={2.5} />
        </button>
      </div>

      <div className={styles.cardMain}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{view.title.trim() || "Untitled slide"}</h2>
            <span className={slide.imageKey ? styles.pillBanner : styles.pillGradient}>
              {slide.imageKey ? "Banner" : "Gradient"}
            </span>
            <span className={slide.isActive ? styles.pillLive : styles.pillHidden}>
              {slide.isActive ? "Visible" : "Hidden"}
            </span>
            <span
              className={translatedLangs.length === 6 ? styles.pillLangFull : styles.pillLang}
              title={
                translatedLangs.length
                  ? `Translated into ${translatedLangs.map((l) => l.toUpperCase()).join(", ")}`
                  : "English only — use Generate on a field to fill the rest"
              }
            >
              <Languages size={11} strokeWidth={2.25} />
              {translatedLangs.length === 6 ? "All languages" : `EN +${translatedLangs.length}`}
            </span>
            {dirty && <span className={styles.pillDirty}>Unsaved</span>}
          </div>

          <div className={styles.cardActions}>
            <button
              type="button"
              className={`${styles.toggle} ${slide.isActive ? styles.toggleOn : ""}`}
              onClick={() => onPatch(slide.id, { isActive: !slide.isActive })}
              disabled={saving}
              aria-pressed={slide.isActive}
              title={slide.isActive ? "Hide this slide" : "Show this slide"}
            >
              {slide.isActive ? <Eye size={14} strokeWidth={2} /> : <EyeOff size={14} strokeWidth={2} />}
              {slide.isActive ? "Visible" : "Hidden"}
            </button>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => onDelete(slide)}
              disabled={saving}
              aria-label={`Delete slide ${index + 1}`}
              title="Delete this slide"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className={styles.cardBody}>
          {/* Preview and its image control sit together: the picture is the
              thing the preview is mostly about. */}
          <div className={styles.previewCol}>
            <SlidePreview slide={view} />
            <p className={styles.previewNote}>
              The preview shows the English slide. Other languages swap the copy and keep this layout.
            </p>
            <div className={styles.mediaRow}>
              <MediaPicker
                value={slide.imageKey}
                previewUrl={slide.imageUrl}
                mediaType="image"
                label="banner image"
                asAddTile
                className={styles.mediaTile}
                onChange={(storageKey) => onPatch(slide.id, { imageKey: storageKey })}
              />
              <span className={styles.mediaHint}>
                {slide.imageKey
                  ? "Wide image, roughly 3:1. Text sits on top, so avoid busy centres."
                  : "No image — this slide uses the brand gradient."}
              </span>
            </div>
          </div>

          <div className={styles.fieldsCol}>
            <fieldset className={styles.group}>
              <legend className={styles.groupTitle}>Content</legend>
              <div className={styles.groupBody}>
                <LocalizedTextField
                  className={styles.locSlotThird}
                  label="Eyebrow"
                  value={mapFor("eyebrow", slide.eyebrow)}
                  onCommit={(map) => commitLocalized("eyebrow", map)}
                  onDraftChange={(map) => setDraft((d) => ({ ...d, eyebrow: map[DEFAULT_LOCALE] ?? null }))}
                  placeholder="New season"
                  translateEndpoint={TRANSLATE_TEXT}
                  disabled={saving}
                />
                <LocalizedTextField
                  className={styles.locSlotTwoThirds}
                  label="Title *"
                  value={mapFor("title", slide.title)}
                  onCommit={(map) => commitLocalized("title", map)}
                  onDraftChange={(map) => setDraft((d) => ({ ...d, title: map[DEFAULT_LOCALE] ?? "" }))}
                  placeholder="Welcome to Silomis"
                  translateEndpoint={TRANSLATE_TEXT}
                  disabled={saving}
                />
                <LocalizedTextField
                  className={styles.locSlot}
                  label="Subtitle"
                  value={mapFor("subtitle", slide.subtitle)}
                  onCommit={(map) => commitLocalized("subtitle", map)}
                  onDraftChange={(map) => setDraft((d) => ({ ...d, subtitle: map[DEFAULT_LOCALE] ?? null }))}
                  placeholder="Quality products, delivered to your door."
                  multiline
                  translateEndpoint={TRANSLATE_TEXT}
                  disabled={saving}
                />
                {slide.imageKey && (
                  <LocalizedTextField
                    className={styles.locSlot}
                    label="Image description"
                    hint="Read aloud by screen readers in place of the picture, so it is worth translating too."
                    value={mapFor("imageAlt", slide.imageAlt)}
                    onCommit={(map) => commitLocalized("imageAlt", map)}
                    placeholder="Describes the picture for screen readers"
                    translateEndpoint={TRANSLATE_TEXT}
                    disabled={saving}
                  />
                )}
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.groupTitle}>Buttons</legend>
              <div className={styles.groupBody}>
                <div className={styles.ctaRow}>
                  <span className={styles.ctaBadgePrimary}>Main</span>
                  <LocalizedTextField
                    className={styles.locSlotCta}
                    label="Label"
                    value={mapFor("ctaLabel", slide.ctaLabel)}
                    onCommit={(map) => commitLocalized("ctaLabel", map)}
                    onDraftChange={(map) => setDraft((d) => ({ ...d, ctaLabel: map[DEFAULT_LOCALE] ?? null }))}
                    placeholder="Shop now"
                    translateEndpoint={TRANSLATE_TEXT}
                    disabled={saving}
                  />
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Links to</span>
                    <input
                      className={ui.input}
                      defaultValue={slide.ctaHref ?? ""}
                      placeholder="/shop"
                      onBlur={(e) => commitPlain("ctaHref", e.target.value)}
                      disabled={saving}
                    />
                  </label>
                </div>
                <div className={styles.ctaRow}>
                  <span className={styles.ctaBadgeSecondary}>Second</span>
                  <LocalizedTextField
                    className={styles.locSlotCta}
                    label="Label"
                    value={mapFor("ctaSecondaryLabel", slide.ctaSecondaryLabel)}
                    onCommit={(map) => commitLocalized("ctaSecondaryLabel", map)}
                    onDraftChange={(map) =>
                      setDraft((d) => ({ ...d, ctaSecondaryLabel: map[DEFAULT_LOCALE] ?? null }))
                    }
                    placeholder="Browse collections"
                    translateEndpoint={TRANSLATE_TEXT}
                    disabled={saving}
                  />
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Links to</span>
                    <input
                      className={ui.input}
                      defaultValue={slide.ctaSecondaryHref ?? ""}
                      placeholder="/collections"
                      onBlur={(e) => commitPlain("ctaSecondaryHref", e.target.value)}
                      disabled={saving}
                    />
                  </label>
                </div>
                <p className={styles.groupNote}>
                  A button appears only when it has both a label and a link. Links are the same in every language —
                  use storefront paths without a language prefix (<code>/shop</code>, <code>/sale</code>) or a full
                  https:// address. Changes save as you leave each field.
                </p>
              </div>
            </fieldset>
          </div>
        </div>
      </div>
    </li>
  );
}
