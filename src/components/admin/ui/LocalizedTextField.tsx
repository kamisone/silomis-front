"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Check } from "lucide-react";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import SectionGenerateButton from "@/components/admin/SectionGenerateButton";
import { useSectionGenerate } from "@/hooks/useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import ui from "./admin-ui.module.css";
import styles from "./LocalizedTextField.module.css";

const LANG_FLAG: Record<Locale, string> = {
  en: "🇬🇧", fr: "🇫🇷", es: "🇪🇸", it: "🇮🇹", de: "🇩🇪", nl: "🇳🇱", pl: "🇵🇱",
};
const LANG_NAME: Record<Locale, string> = {
  en: "English", fr: "Français", es: "Español", it: "Italiano", de: "Deutsch", nl: "Nederlands", pl: "Polski",
};

/** Copy keyed by locale. Every locale is optional — the storefront falls back. */
export type LocalizedTextMap = Partial<Record<Locale, string>>;

/** Accepts the plain-string form too, so a value written before these fields
 *  were localized still opens in the editor instead of blanking. */
export function toLocalizedMap(value: LocalizedTextMap | string | null | undefined): LocalizedTextMap {
  if (!value) return {};
  if (typeof value === "string") return value.trim() ? { [DEFAULT_LOCALE]: value } : {};
  return value;
}

/** An empty rich-text editor still serialises to markup — "<p></p>" is not copy,
 *  and storing it would make the field count as written in that language. */
const EMPTY_HTML = /^(\s|<p>|<\/p>|<br\s*\/?>|&nbsp;)*$/i;

/** Drops empty locales so the stored value stays the set of languages actually
 *  written, not a record of every tab that was ever opened. */
function prune(map: LocalizedTextMap): LocalizedTextMap {
  const out: LocalizedTextMap = {};
  for (const l of LOCALES) {
    const v = map[l]?.trim();
    if (v && !EMPTY_HTML.test(v)) out[l] = v;
  }
  return out;
}

function sameMap(a: LocalizedTextMap, b: LocalizedTextMap): boolean {
  return LOCALES.every((l) => (a[l] ?? "") === (b[l] ?? ""));
}

// TipTap/ProseMirror needs browser globals — same client-only load BilingualField uses.
const RichTextEditor = dynamic(() => import("@/components/admin/content/RichTextEditor"), { ssr: false });

/**
 * One field, in seven languages, with a Generate button.
 *
 * Only one language is on screen at a time — the tab strip marks which ones
 * have text, which is the question an editor actually asks ("what still needs
 * translating?") without stacking seven inputs per field. Generate takes the
 * English the admin just wrote and fills the other six in one call, so the
 * strip goes from 1/7 to 7/7 without leaving the field.
 *
 * Storage is the caller's business: `onCommit` hands back the whole map, and
 * the page decides whether that becomes a JSON blob (home sections) or an
 * English column plus six translation rows (hero slides).
 */
export default function LocalizedTextField({
  label,
  hint,
  value,
  onCommit,
  onDraftChange,
  multiline = false,
  richText = false,
  placeholder,
  disabled = false,
  rows = 2,
  translateEndpoint,
  className,
  maxLength,
  hideLabel = false,
}: {
  label: string;
  hint?: string;
  value: LocalizedTextMap | string | null | undefined;
  /** Fired on blur and after Generate, only when something actually changed. */
  onCommit: (next: LocalizedTextMap) => void;
  /** Fired on every keystroke, for callers driving a live preview. */
  onDraftChange?: (next: LocalizedTextMap) => void;
  multiline?: boolean;
  /** Render the rich-text (HTML) editor instead of an input or textarea. */
  richText?: boolean;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  /** POST endpoint taking `{ text }` (or `{ html }` when richText) and returning
   *  a SectionTranslationOutcome. Omit to hide the Generate button. */
  translateEndpoint?: string;
  className?: string;
  /** Hard cap per locale, matching whatever the API accepts for this field.
   *  Enforced here so an over-long entry is impossible rather than a 400. */
  maxLength?: number;
  /** Drop the visible label when the surrounding field already prints one.
   *  The translation meter stays: it answers a different question from the
   *  label, and it is the only place that answer appears. `label` is still
   *  required — it names the control for assistive tech either way. */
  hideLabel?: boolean;
}) {
  const [lang, setLang] = useState<Locale>(DEFAULT_LOCALE);
  const [draft, setDraft] = useState<LocalizedTextMap>(() => toLocalizedMap(value));

  const gen = useSectionGenerate<SectionTranslationOutcome<string>>(translateEndpoint ?? "");
  const [partialError, setPartialError] = useState<string | null>(null);

  // Re-sync when the saved value comes back changed (another field's PATCH
  // returns the whole record). Skipped while this field has focus so a save
  // elsewhere can't yank text out from under the cursor.
  const focused = useRef(false);
  // What we last handed upward. Switching tabs blurs the input *and* fires the
  // button's click, so both call commit() before the save has come back — this
  // is what stops the second one from re-sending the same text.
  const committed = useRef<LocalizedTextMap>(prune(toLocalizedMap(value)));
  useEffect(() => {
    committed.current = prune(toLocalizedMap(value));
    if (focused.current) return;
    setDraft(toLocalizedMap(value));
  }, [value]);

  function commit(next: LocalizedTextMap = draft) {
    const pruned = prune(next);
    if (sameMap(pruned, committed.current)) return;
    committed.current = pruned;
    onCommit(pruned);
  }

  const current = draft[lang] ?? "";
  const source = draft[DEFAULT_LOCALE]?.trim() ?? "";
  const filledCount = LOCALES.filter((l) => draft[l]?.trim() && !EMPTY_HTML.test(draft[l]!)).length;

  function set(text: string) {
    const next = { ...draft, [lang]: text };
    setDraft(next);
    onDraftChange?.(prune(next));
  }

  /** English in, the other six out — then saved straight away, because the
   *  admin's next move is reading the result, not tabbing out of the field. */
  async function generate() {
    setPartialError(null);
    const outcome = await gen.generate(richText ? { html: source } : { text: source });
    if (!outcome) return;
    const next: LocalizedTextMap = { ...draft };
    for (const [l, text] of Object.entries(outcome.result) as [Locale, string][]) {
      if (text?.trim()) next[l] = text;
    }
    setDraft(next);
    onDraftChange?.(prune(next));
    commit(next);
    setPartialError(summarizeGenerateErrors(outcome.errors));
  }

  return (
    <div className={`${styles.field} ${className ?? ""}`}>
      <div className={`${styles.head} ${hideLabel ? styles.headCompact : ""}`}>
        <span className={styles.label}>
          {hideLabel ? <span className={styles.srOnly}>{label}</span> : label}
          <span className={`${styles.meter} ${filledCount === LOCALES.length ? styles.meterFull : ""}`}>
            {filledCount === LOCALES.length && <Check size={9} strokeWidth={3.5} />}
            {filledCount}/{LOCALES.length}
          </span>
        </span>

        <div className={styles.controls}>
          <div className={styles.tabs} role="group" aria-label={`${label} language`}>
            {LOCALES.map((l) => {
              const text = draft[l]?.trim();
              const filled = !!text && !EMPTY_HTML.test(text);
              return (
                <button
                  key={l}
                  type="button"
                  className={`${styles.tab} ${l === lang ? styles.tabActive : ""} ${filled ? styles.tabFilled : ""}`}
                  onClick={() => {
                    // Commit before switching: the tab strip is the only way out
                    // of a field for a keyboard-free editor, and a lost paragraph
                    // is a far worse outcome than a redundant save.
                    commit();
                    setLang(l);
                  }}
                  title={`${LANG_NAME[l]} — ${filled ? "written" : "empty"}`}
                  aria-pressed={l === lang}
                >
                  <span aria-hidden="true">{LANG_FLAG[l]}</span>
                  <span className={styles.tabCode}>{l.toUpperCase()}</span>
                  {filled && <span className={styles.tabDot} aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          {translateEndpoint && (
            <SectionGenerateButton
              onClick={generate}
              generating={gen.generating}
              disabled={disabled || !source}
              title={source ? "Fill the other six languages from English" : "Write the English version first"}
            />
          )}
        </div>
      </div>

      <div
        className={styles.inputWrap}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
      >
        {richText ? (
          // RichTextEditor has no onBlur of its own; focusout bubbles out of the
          // contenteditable to this wrapper, which is the commit point.
          <RichTextEditor key={lang} content={current} onChange={set} />
        ) : multiline ? (
          <textarea
            className={ui.textarea}
            value={current}
            maxLength={maxLength}
            onChange={(e) => set(e.target.value)}
            placeholder={lang === DEFAULT_LOCALE ? placeholder : "Leave blank to fall back to English"}
            rows={rows}
            disabled={disabled}
          />
        ) : (
          <input
            className={ui.input}
            value={current}
            maxLength={maxLength}
            onChange={(e) => set(e.target.value)}
            placeholder={lang === DEFAULT_LOCALE ? placeholder : "Leave blank to fall back to English"}
            disabled={disabled}
          />
        )}
        {gen.generating && <span className={styles.busyVeil} aria-hidden="true" />}
      </div>

      {(gen.error || partialError) && <p className={styles.error}>{gen.error ?? partialError}</p>}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
