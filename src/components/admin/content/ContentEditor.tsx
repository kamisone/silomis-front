"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { api } from "@/lib/api";
import { LOCALES, type Locale } from "@/lib/i18n";
import LocalizedTextField, { type LocalizedTextMap } from "@/components/admin/ui/LocalizedTextField";
import RichTextEditor from "./RichTextEditor";
import styles from "./ContentEditor.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageSection {
  title: string;
  body: string;
}

interface PageContentData {
  title: string;
  intro: string;
  sections: PageSection[];
}

export type ContentSlug = "about" | "privacy-policy" | "legal" | "cookies" | "sale" | "new";

export interface ContentPage {
  slug: ContentSlug;
  label: string;
}

/** One record per language, which is how page content is stored: `sale`/`fr` is
 *  its own row, independent of `sale`/`en`. */
type ByLocale = Record<Locale, PageContentData>;

/** The plain-copy endpoint every Generate button in the admin shares. */
const TRANSLATE_TEXT = "/next-api/admin/shop/translate/text";

const LOCALE_LABEL: Record<Locale, string> = {
  en: "🇬🇧 English", fr: "🇫🇷 Français", es: "🇪🇸 Español",
  it: "🇮🇹 Italiano", de: "🇩🇪 Deutsch", nl: "🇳🇱 Nederlands", pl: "🇵🇱 Polski",
};

/** The default set — the policy pages under Content. `sale` and `new` are not
 * here: neither is a policy, and each lives next to what fills the page it
 * edits (admin/shop/promotions/sale-page, admin/shop/new-page), which is where
 * an admin looks for it. */
const POLICY_PAGES: ContentPage[] = [
  { slug: "about", label: "About" },
  { slug: "privacy-policy", label: "Privacy Policy" },
  { slug: "legal", label: "Legal" },
  { slug: "cookies", label: "Cookie Policy" },
];

const EMPTY: PageContentData = { title: "", intro: "", sections: [] };

function emptyByLocale(): ByLocale {
  return Object.fromEntries(LOCALES.map((l) => [l, { ...EMPTY, sections: [] }])) as unknown as ByLocale;
}

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

function normalize(raw: Partial<PageContentData> | undefined): PageContentData {
  return {
    title: raw?.title ?? "",
    intro: raw?.intro ?? "",
    sections: Array.isArray(raw?.sections) ? raw.sections : [],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

type LocalizedField = "title" | "intro";

export interface ContentEditorProps {
  /** Pages this instance edits. A single page hides the tab row entirely. */
  pages?: ContentPage[];
  /** Hint beside the locale switcher — what saving here actually affects. */
  note?: string;
  /** Renders the title and intro as LocalizedTextFields — seven language tabs
   * and a Translate button on each — instead of one input for the language on
   * screen. Off by default: the policy pages are legal copy, and
   * machine-translating that is a decision to make per page, not a default. */
  translate?: boolean;
}

export default function ContentEditor({
  pages = POLICY_PAGES,
  note = "Editing overrides the built-in page text when saved",
  translate = false,
}: ContentEditorProps = {}) {
  const [slug, setSlug] = useState<ContentSlug>(pages[0].slug);
  /** Which language the *sections* below are written in. The title and intro
   *  carry their own language tabs in translate mode. */
  const [locale, setLocale] = useState<Locale>("en");
  const [byLocale, setByLocale] = useState<ByLocale>(emptyByLocale);
  /** Languages edited since the last load — the only ones Save writes back. */
  const [dirty, setDirty] = useState<Partial<Record<Locale, boolean>>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = byLocale[locale];

  /**
   * One request for every language of this page, rather than one per language
   * switch: a LocalizedTextField shows all seven at once, so they all have to
   * be in memory anyway, and switching the sections language stops being a
   * round trip.
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const rows = await api.get<Array<{ slug: string; locale: string; data: Partial<PageContentData> }> | null>("/next-api/admin/content");
      const next = emptyByLocale();
      for (const row of rows ?? []) {
        if (row.slug === slug && isLocale(row.locale)) next[row.locale] = normalize(row.data);
      }
      setByLocale(next);
      setDirty({});
    } catch {
      setError("Could not load content.");
      setByLocale(emptyByLocale());
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Edits one language — the one whose sections are on screen. */
  const patch = (lang: Locale, change: Partial<PageContentData>) => {
    setByLocale((prev) => ({ ...prev, [lang]: { ...prev[lang], ...change } }));
    setDirty((d) => ({ ...d, [lang]: true }));
  };

  const setField = (field: LocalizedField, val: string) => patch(locale, { [field]: val });

  /** LocalizedTextField speaks in whole maps, so read one out of the per-language
   *  records and write one back across them. */
  const fieldMap = (field: LocalizedField): LocalizedTextMap =>
    Object.fromEntries(LOCALES.map((l) => [l, byLocale[l][field]] as const).filter(([, v]) => !!v)) as LocalizedTextMap;

  const applyFieldMap = (field: LocalizedField, next: LocalizedTextMap) => {
    // A language the map no longer carries was cleared, not left alone — the
    // control prunes empty entries before handing the map back.
    const changed = LOCALES.filter((l) => byLocale[l][field] !== (next[l] ?? ""));
    if (!changed.length) return;
    setByLocale((prev) => {
      const out = { ...prev };
      for (const l of changed) out[l] = { ...out[l], [field]: next[l] ?? "" };
      return out;
    });
    setDirty((d) => {
      const out = { ...d };
      for (const l of changed) out[l] = true;
      return out;
    });
    setSaved(false);
  };

  const setSections = (fn: (sections: PageSection[]) => PageSection[]) => patch(locale, { sections: fn(data.sections) });

  const addSection = () => setSections((s) => [...s, { title: "", body: "" }]);
  const removeSection = (i: number) => setSections((s) => s.filter((_, idx) => idx !== i));
  const setSectionTitle = (i: number, val: string) => setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, title: val } : sec)));
  const setSectionBody = (i: number, val: string) => setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, body: val } : sec)));
  const moveSection = (i: number, dir: -1 | 1) =>
    setSections((s) => {
      const out = [...s];
      const j = i + dir;
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    // Translating a field edits six languages at once, so a save is no longer
    // "write the record on screen". Sequential, not Promise.all: seven requests
    // at once race the session's refresh-token rotation and the losers come
    // back 401.
    const targets = LOCALES.filter((l) => dirty[l]);
    const failed: string[] = [];
    for (const lang of targets.length ? targets : [locale]) {
      try {
        await api.put(`/next-api/admin/content/${slug}/${lang}`, byLocale[lang]);
      } catch {
        failed.push(lang.toUpperCase());
      }
    }
    if (failed.length) {
      setError(`Could not save ${failed.join(", ")}.`);
    } else {
      setDirty({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const localeBar = (
    <div className={styles.localeBar}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          className={`${styles.localeBtn} ${locale === l ? styles.localeBtnActive : ""}`}
          onClick={() => setLocale(l)}
        >
          {LOCALE_LABEL[l]}
        </button>
      ))}
      <span className={styles.localeNote}>{translate ? "Sections are written per language" : note}</span>
    </div>
  );

  return (
    <div className={styles.editor}>
      {/* ── Page tabs ── */}
      {pages.length > 1 && (
        <div className={styles.pageTabs}>
          {pages.map((p) => (
            <button
              key={p.slug}
              type="button"
              className={`${styles.pageTab} ${slug === p.slug ? styles.pageTabActive : ""}`}
              onClick={() => setSlug(p.slug)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Locale switcher ──
          Only when it governs the whole form. In translate mode the title and
          intro carry their own tabs, so a second language picker above them
          would be claiming to control fields it does not; it moves down to the
          sections, which are the only thing left that it does control. */}
      {!translate && localeBar}

      {/* ── Body ── */}
      {loading ? (
        <div className={styles.loadingRow}>Loading…</div>
      ) : (
        <div className={styles.fields}>
          {translate && <p className={styles.fieldsNote}>{note}</p>}

          {translate ? (
            <>
              <LocalizedTextField
                label="Page title"
                value={fieldMap("title")}
                onCommit={(next) => applyFieldMap("title", next)}
                placeholder="Page title"
                overlayPlaceholder="Leave blank to render no title in this language"
                translateEndpoint={TRANSLATE_TEXT}
              />
              <LocalizedTextField
                label="Intro / summary"
                value={fieldMap("intro")}
                onCommit={(next) => applyFieldMap("intro", next)}
                placeholder="Short introduction shown below the title"
                overlayPlaceholder="Leave blank to render no intro in this language"
                multiline
                rows={3}
                translateEndpoint={TRANSLATE_TEXT}
              />
            </>
          ) : (
            <>
              <div className={styles.field}>
                <div className={styles.fieldHeader}>
                  <label className={styles.fieldLabel} htmlFor="content-title">
                    Page title
                  </label>
                </div>
                <input
                  id="content-title"
                  className={styles.fieldInput}
                  value={data.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Page title"
                />
              </div>

              <div className={styles.field}>
                <div className={styles.fieldHeader}>
                  <label className={styles.fieldLabel} htmlFor="content-intro">
                    Intro / summary
                  </label>
                </div>
                <textarea
                  id="content-intro"
                  className={styles.fieldTextarea}
                  value={data.intro}
                  onChange={(e) => setField("intro", e.target.value)}
                  placeholder="Short introduction shown below the title"
                  rows={3}
                />
              </div>
            </>
          )}

          <div className={styles.sectionsHeader}>
            <span className={styles.sectionsTitle}>Sections</span>
            <button type="button" className={styles.addSectionBtn} onClick={addSection}>+ Add section</button>
          </div>

          {translate && localeBar}

          {data.sections.map((sec, i) => (
            <div key={i} className={styles.sectionCard}>
              <div className={styles.sectionCardHeader}>
                <span className={styles.sectionIndex}>#{i + 1}</span>
                <input
                  className={styles.sectionTitleInput}
                  value={sec.title}
                  onChange={(e) => setSectionTitle(i, e.target.value)}
                  placeholder="Section title"
                />
                <div className={styles.sectionActions}>
                  <button type="button" className={styles.sectionMoveBtn} disabled={i === 0} onClick={() => moveSection(i, -1)} title="Move up">
                    <ChevronUp size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    className={styles.sectionMoveBtn}
                    disabled={i === data.sections.length - 1}
                    onClick={() => moveSection(i, 1)}
                    title="Move down"
                  >
                    <ChevronDown size={14} strokeWidth={1.75} />
                  </button>
                  <button type="button" className={styles.sectionRemoveBtn} onClick={() => removeSection(i)} title="Remove section">
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
              <RichTextEditor key={`${slug}-${locale}-${i}`} content={sec.body} onChange={(html) => setSectionBody(i, html)} />
            </div>
          ))}

          {data.sections.length === 0 && <p className={styles.emptySections}>No sections yet. Click &ldquo;Add section&rdquo; to start.</p>}
        </div>
      )}

      {/* ── Footer bar ── */}
      <div className={styles.footerBar}>
        {error && <span className={styles.errorMsg}>{error}</span>}
        {saved && <span className={styles.savedMsg}>Saved ✓</span>}
        <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving || loading}>
          {saving ? "Saving…" : "Save & publish"}
        </button>
      </div>
    </div>
  );
}
