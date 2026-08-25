"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import type { LocalizedText } from "@/components/home/sectionTypes";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./HomeSections.module.css";

// TipTap needs browser globals — same client-only load BilingualField uses.
const RichTextEditor = dynamic(() => import("@/components/admin/content/RichTextEditor"), { ssr: false });

const LANG_FLAG: Record<Locale, string> = {
  en: "🇬🇧", fr: "🇫🇷", es: "🇪🇸", it: "🇮🇹", de: "🇩🇪", nl: "🇳🇱", pl: "🇵🇱",
};

type TextMap = Partial<Record<Locale, string>>;

/** Accepts the plain-string form too, so a config written before these blocks
 *  were localized still opens in the editor instead of blanking. */
function toMap(value: LocalizedText | null | undefined): TextMap {
  if (!value) return {};
  if (typeof value === "string") return value.trim() ? { [DEFAULT_LOCALE]: value } : {};
  return value;
}

/** An empty rich-text editor still serialises to markup — "<p></p>" is not copy,
 *  and storing it would make the block count as written in that language. */
const EMPTY_HTML = /^(\s|<p>|<\/p>|<br\s*\/?>|&nbsp;)*$/i;

/** Drops empty locales so the stored config stays the set of languages actually
 *  written, not a record of every tab that was ever opened. */
function prune(map: TextMap): TextMap {
  const out: TextMap = {};
  for (const l of LOCALES) {
    const v = map[l]?.trim();
    if (v && !EMPTY_HTML.test(v)) out[l] = v;
  }
  return out;
}

function sameMap(a: TextMap, b: TextMap): boolean {
  return LOCALES.every((l) => (a[l] ?? "") === (b[l] ?? ""));
}

/**
 * One config field, in seven languages.
 *
 * The editorial blocks keep their copy inside the section's JSON rather than in
 * the translations table, so this is where the per-locale editing lives. Only
 * one language is on screen at a time — the tab strip marks which ones have
 * text, which is the question an editor actually asks ("what still needs
 * translating?") without stacking seven inputs per field.
 *
 * Storefront falls back to English, then to any locale with text, so leaving
 * tabs blank degrades gracefully rather than showing a gap.
 */
export default function LocalizedTextField({
  label,
  hint,
  value,
  onCommit,
  multiline = false,
  richText = false,
  placeholder,
  disabled = false,
  rows = 2,
}: {
  label: string;
  hint?: string;
  value: LocalizedText | null | undefined;
  /** Fired on blur, only when something actually changed. */
  onCommit: (next: TextMap) => void;
  multiline?: boolean;
  richText?: boolean;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}) {
  const [lang, setLang] = useState<Locale>(DEFAULT_LOCALE);
  const [draft, setDraft] = useState<TextMap>(() => toMap(value));

  // Re-sync when the saved config comes back changed (another field's PATCH
  // returns the whole section). Skipped while this field has focus so a save
  // elsewhere can't yank text out from under the cursor.
  const focused = useRef(false);
  // What we last handed upward. Switching tabs blurs the input *and* fires the
  // button's click, so both call commit() before the PATCH has come back — this
  // is what stops the second one from re-sending the same text.
  const committed = useRef<TextMap>(prune(toMap(value)));
  useEffect(() => {
    committed.current = prune(toMap(value));
    if (focused.current) return;
    setDraft(toMap(value));
  }, [value]);

  function commit() {
    const next = prune(draft);
    if (sameMap(next, committed.current)) return;
    committed.current = next;
    onCommit(next);
  }

  const current = draft[lang] ?? "";
  const set = (text: string) => setDraft((d) => ({ ...d, [lang]: text }));

  return (
    <div className={styles.locField}>
      <div className={styles.locHead}>
        <span className={styles.fieldLabel}>{label}</span>
        <div className={styles.locTabs} role="group" aria-label={`${label} language`}>
          {LOCALES.map((l) => {
            const filled = !!draft[l]?.trim();
            return (
              <button
                key={l}
                type="button"
                className={`${styles.locTab} ${l === lang ? styles.locTabActive : ""} ${filled ? styles.locTabFilled : ""}`}
                onClick={() => {
                  // Commit before switching: the tab strip is the only way out
                  // of a field for a keyboard-free editor, and a lost paragraph
                  // is a far worse outcome than a redundant PATCH.
                  commit();
                  setLang(l);
                }}
                title={filled ? `${l.toUpperCase()} — translated` : `${l.toUpperCase()} — empty`}
                aria-pressed={l === lang}
              >
                <span aria-hidden="true">{LANG_FLAG[l]}</span>
                <span className={styles.locTabCode}>{l.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
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
            className={ui.input}
            value={current}
            onChange={(e) => set(e.target.value)}
            placeholder={lang === DEFAULT_LOCALE ? placeholder : "Leave blank to fall back to English"}
            rows={rows}
            disabled={disabled}
          />
        ) : (
          <input
            className={ui.input}
            value={current}
            onChange={(e) => set(e.target.value)}
            placeholder={lang === DEFAULT_LOCALE ? placeholder : "Leave blank to fall back to English"}
            disabled={disabled}
          />
        )}
      </div>

      {hint && <p className={styles.locHint}>{hint}</p>}
    </div>
  );
}
