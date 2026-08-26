"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Languages, Trash2 } from "lucide-react";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import LocalizedTextField, { type LocalizedTextMap } from "@/components/admin/ui/LocalizedTextField";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { useLocalizedEntity } from "@/hooks/useLocalizedEntity";
import { stripHtml } from "@/lib/html";
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
  /** The card's copy as one HTML block from the WYSIWYG. */
  content: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryHref: string | null;
}

/** Copy fields: written in English on the slide itself, then in six more
 *  languages as translation rows. */
type LocalizedField = "imageAlt" | "eyebrow" | "content" | "ctaLabel" | "ctaSecondaryLabel";

/** Links are addresses, not copy — the same path serves every language. */
type PlainField = "ctaHref" | "ctaSecondaryHref";

/** The storefront reads slide overlays under this entity type — see
 *  HeroSlidesService.publicList. */
const ENTITY_TYPE = "shop_home_hero_slide";

/** The card header wants a name, not markup — and never an empty strip. */
function slideLabel(content: string | null | undefined): string {
  const text = stripHtml(content);
  if (!text) return "Untitled slide";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

const TRANSLATE_TEXT = "/next-api/admin/shop/hero-slides/sections/text/translate";
/** The card's copy is HTML, so it goes through the endpoint that translates
 *  around the markup rather than the plain-text one. */
const TRANSLATE_HTML = "/next-api/admin/shop/hero-slides/sections/html/translate";

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
  onDirtyChange,
}: {
  slide: HeroSlide;
  index: number;
  total: number;
  saving: boolean;
  onPatch: (id: string, body: Partial<HeroSlide>) => Promise<void>;
  onMove: (index: number, delta: -1 | 1) => void;
  onDelete: (slide: HeroSlide) => void;
  onError: (message: string) => void;
  /** Lets the sticky bar say whether anything is still uncommitted. */
  onDirtyChange?: (id: string, dirty: boolean) => void;
}) {
  const { mapFor, saveField } = useLocalizedEntity(ENTITY_TYPE, slide.id);
  // Unsaved English keystrokes. Lets the preview follow what is being typed
  // instead of lagging a round-trip behind.
  const [draft, setDraft] = useState<Partial<HeroSlide>>({});

  const view = { ...slide, ...draft };
  const dirty = Object.keys(draft).length > 0;

  // Mirrored in a ref so the parent can be told synchronously, from the same
  // event that changed the draft. Reporting from an effect would be a setState
  // during render's commit, and reporting from inside a state updater would
  // make the updater impure — both are exactly what the lint rules forbid.
  const dirtyFields = useRef<Set<string>>(new Set());
  function markDirty(field: string, isDirty: boolean) {
    if (isDirty) dirtyFields.current.add(field);
    else dirtyFields.current.delete(field);
    onDirtyChange?.(slide.id, dirtyFields.current.size > 0);
  }

  function noteDraft(field: keyof HeroSlide, value: string | null) {
    setDraft((d) => ({ ...d, [field]: value }));
    markDirty(field, true);
  }

  function clearDraft(field: keyof HeroSlide) {
    setDraft((d) => {
      if (!(field in d)) return d;
      const rest = { ...d };
      delete rest[field];
      return rest;
    });
    markDirty(field, false);
  }

  /** English lands on the slide, the other six become translation rows. Both
   *  only when they actually changed, so tabbing through a slide doesn't fire
   *  a dozen pointless requests. */
  async function commitLocalized(field: LocalizedField, map: LocalizedTextMap) {
    const base = map[DEFAULT_LOCALE]?.trim() ?? "";
    if (field === "content" && !stripHtml(base)) {
      onError("A slide needs some copy");
      clearDraft("content");
      return;
    }
    noteDraft(field, base || null);
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
    (l) => l !== DEFAULT_LOCALE && (["eyebrow", "content", "ctaLabel", "ctaSecondaryLabel"] as const).some(
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
            <h2 className={styles.cardTitle}>{slideLabel(view.content)}</h2>
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
                  className={styles.locSlot}
                  label="Eyebrow"
                  hint="Plain text — it renders as a small pill beside an icon, which markup would only fight."
                  value={mapFor("eyebrow", slide.eyebrow)}
                  onCommit={(map) => commitLocalized("eyebrow", map)}
                  onDraftChange={(map) => noteDraft("eyebrow", map[DEFAULT_LOCALE] ?? null)}
                  placeholder="New season"
                  translateEndpoint={TRANSLATE_TEXT}
                  disabled={saving}
                />
                <LocalizedTextField
                  className={styles.locSlot}
                  label="Card copy *"
                  hint="The whole card: a heading, a line under it, a list if you want one. The first heading becomes the page's H1 on the visible slide."
                  value={mapFor("content", slide.content)}
                  onCommit={(map) => commitLocalized("content", map)}
                  onDraftChange={(map) => noteDraft("content", map[DEFAULT_LOCALE] ?? null)}
                  richText
                  translateEndpoint={TRANSLATE_HTML}
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
                    onDraftChange={(map) => noteDraft("ctaLabel", map[DEFAULT_LOCALE] ?? null)}
                    placeholder="Shop now"
                    translateEndpoint={TRANSLATE_TEXT}
                    disabled={saving}
                  />
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Links to</span>
                    <input
                      className={ui.input}
                      defaultValue={slide.ctaHref ?? ""}
                      placeholder="/collections"
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
                    onDraftChange={(map) => noteDraft("ctaSecondaryLabel", map[DEFAULT_LOCALE] ?? null)}
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
