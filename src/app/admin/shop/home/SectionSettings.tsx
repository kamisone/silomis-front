"use client";

import MediaPicker from "@/components/admin/ui/MediaPicker";
import ui from "@/components/admin/ui/admin-ui.module.css";
import {
  EDITORIAL_SECTION_TYPES,
  SECTION_DEFAULT_LIMIT,
  SECTION_META,
  type HomeSectionConfig,
  type HomeSectionType,
} from "@/components/home/sectionTypes";
import LocalizedTextField from "@/components/admin/ui/LocalizedTextField";
import styles from "./HomeSections.module.css";

// Every text field on this page is ordinary copy, so one endpoint serves them
// all — plain fields post `{ text }`, the rich-text body posts `{ html }`.
const TRANSLATE_TEXT = "/next-api/admin/shop/home-sections/sections/text/translate";
const TRANSLATE_HTML = "/next-api/admin/shop/home-sections/sections/html/translate";

/**
 * The settings band under a section card.
 *
 * Split out of the page because the editorial blocks turned this from "three
 * inputs in a row" into a real form: seven-language copy, an image picker and a
 * handful of layout switches. The page stays about ordering sections; this file
 * is about configuring one.
 *
 * Every control writes through `onChange`, which the page merges into the
 * section's config and PATCHes — the same save-as-you-leave-the-field contract
 * the numeric fields always had.
 */
export default function SectionSettings({
  type,
  config,
  saving,
  onChange,
}: {
  type: HomeSectionType;
  config: HomeSectionConfig;
  saving: boolean;
  onChange: (patch: Partial<HomeSectionConfig>) => void;
}) {
  const fields = SECTION_META[type].fields;
  if (fields.length === 0) return null;

  // Editorial blocks stack: their fields are paragraphs and pickers, not the
  // one-line selects the commerce sections use.
  const stacked = (EDITORIAL_SECTION_TYPES as readonly string[]).includes(type);

  return (
    <div className={`${styles.settings} ${stacked ? styles.settingsStack : ""}`}>
      {fields.includes("source") && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Products</span>
          <select
            className={ui.select}
            value={config.source ?? "newest"}
            onChange={(e) => onChange({ source: e.target.value as "newest" | "featured" })}
            disabled={saving}
          >
            <option value="newest">Newest first</option>
            <option value="featured">Featured products</option>
          </select>
        </label>
      )}

      {fields.includes("title") && (
        <LocalizedTextField
          className={styles.fieldWide}
          label="Heading"
          value={config.title}
          onCommit={(title) => onChange({ title })}
          placeholder="Leave blank for the translated default"
          translateEndpoint={TRANSLATE_TEXT}
          disabled={saving}
        />
      )}

      {fields.includes("limit") && (
        <label className={`${styles.field} ${styles.fieldNarrow}`}>
          <span className={styles.fieldLabel}>Items</span>
          <input
            className={ui.input}
            type="number"
            min={1}
            max={24}
            defaultValue={config.limit ?? SECTION_DEFAULT_LIMIT[type] ?? 8}
            onBlur={(e) => {
              const value = Number.parseInt(e.target.value, 10);
              if (!Number.isFinite(value) || value === config.limit) return;
              onChange({ limit: Math.min(24, Math.max(1, value)) });
            }}
            disabled={saving}
          />
        </label>
      )}

      {fields.includes("eyebrow") && (
        <LocalizedTextField
          label="Eyebrow"
          value={config.eyebrow}
          onCommit={(eyebrow) => onChange({ eyebrow })}
          translateEndpoint={TRANSLATE_TEXT}
          placeholder="New this season"
          disabled={saving}
        />
      )}

      {fields.includes("heading") && (
        <LocalizedTextField
          label={type === "seo_text" ? "Heading" : "Title"}
          value={config.heading}
          onCommit={(heading) => onChange({ heading })}
          translateEndpoint={TRANSLATE_TEXT}
          placeholder={type === "seo_text" ? "About our collection" : "Our favourites right now"}
          disabled={saving}
        />
      )}

      {fields.includes("subtitle") && (
        <LocalizedTextField
          label="Subtitle"
          value={config.subtitle}
          onCommit={(subtitle) => onChange({ subtitle })}
          translateEndpoint={TRANSLATE_TEXT}
          placeholder="One line of context under the title"
          multiline
          disabled={saving}
        />
      )}

      {fields.includes("body") && (
        <LocalizedTextField
          label="Body"
          hint="Written for search engines as much as for readers — a few paragraphs about what you sell, with the words customers actually search for."
          value={config.body}
          onCommit={(body) => onChange({ body })}
          translateEndpoint={TRANSLATE_HTML}
          richText
          disabled={saving}
        />
      )}

      {fields.includes("icon") && (
        <div className={styles.locField}>
          <span className={styles.fieldLabel}>Icon</span>
          <div className={styles.iconRow}>
            <MediaPicker
              value={config.iconImageKey ?? null}
              previewUrl={config.iconImageUrl ?? null}
              mediaType="image"
              label="heading icon"
              asAddTile
              className={styles.iconTile}
              // The URL is stored next to the key so the storefront can print it
              // without a lookup — media/ objects are public and never expire.
              onChange={(storageKey, url) => onChange({ iconImageKey: storageKey, iconImageUrl: url })}
            />
            <span className={styles.locHint}>
              Optional. A small square mark printed just before the title — a badge or an emoji exported as an image.
              Sized to the text, so anything above roughly 96&nbsp;px square is enough.
            </span>
          </div>
        </div>
      )}

      {(fields.includes("align") || fields.includes("tinted")) && (
        <div className={styles.switchRow}>
          {fields.includes("align") && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Alignment</span>
              <select
                className={ui.select}
                value={config.align ?? "left"}
                onChange={(e) => onChange({ align: e.target.value as "left" | "center" })}
                disabled={saving}
              >
                <option value="left">Left</option>
                <option value="center">Centred</option>
              </select>
            </label>
          )}
          {fields.includes("tinted") && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={!!config.tinted}
                onChange={(e) => onChange({ tinted: e.target.checked })}
                disabled={saving}
              />
              <span>
                Tinted background
                <span className={styles.checkHint}>
                  Match this to the section underneath, so the title and what it introduces sit on the same band.
                </span>
              </span>
            </label>
          )}
        </div>
      )}

      {(fields.includes("tone") || fields.includes("height")) && (
        <div className={styles.switchRow}>
          {fields.includes("tone") && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Style</span>
              <select
                className={ui.select}
                value={config.tone ?? "plain"}
                onChange={(e) => onChange({ tone: e.target.value as "plain" | "tint" | "line" })}
                disabled={saving}
              >
                <option value="plain">Empty space</option>
                <option value="tint">Tinted band</option>
                <option value="line">Hairline rule</option>
              </select>
            </label>
          )}
          {fields.includes("height") && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Height</span>
              <select
                className={ui.select}
                value={config.height ?? "md"}
                onChange={(e) => onChange({ height: e.target.value as "sm" | "md" | "lg" })}
                disabled={saving}
              >
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
              </select>
            </label>
          )}
        </div>
      )}

      {fields.includes("flipTint") && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={!!config.flipTint}
            onChange={(e) => onChange({ flipTint: e.target.checked })}
            disabled={saving}
          />
          <span>
            Restart the banding here
            <span className={styles.checkHint}>
              The page alternates white and off-white down the sections. Tick this to flip the order from this point
              down — the fix when a chapter starts on the wrong shade.
            </span>
          </span>
        </label>
      )}

      <span className={styles.settingsNote}>Changes save as you leave each field.</span>
    </div>
  );
}
