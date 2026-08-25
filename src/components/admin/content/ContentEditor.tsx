"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { api } from "@/lib/api";
import { LOCALES, type Locale } from "@/lib/i18n";
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

type Slug = "about" | "privacy-policy" | "legal" | "cookies";

const LOCALE_LABEL: Record<Locale, string> = {
  en: "🇬🇧 English", fr: "🇫🇷 Français", es: "🇪🇸 Español",
  it: "🇮🇹 Italiano", de: "🇩🇪 Deutsch", nl: "🇳🇱 Nederlands", pl: "🇵🇱 Polski",
};

const PAGES: { slug: Slug; label: string }[] = [
  { slug: "about", label: "About" },
  { slug: "privacy-policy", label: "Privacy Policy" },
  { slug: "legal", label: "Legal" },
  { slug: "cookies", label: "Cookie Policy" },
];

const EMPTY: PageContentData = { title: "", intro: "", sections: [] };

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContentEditor() {
  const [slug, setSlug] = useState<Slug>("about");
  const [locale, setLocale] = useState<Locale>("en");
  const [data, setData] = useState<PageContentData>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const record = await api.get<{ data: PageContentData } | null>(`/next-api/admin/content/${slug}/${locale}`);
      const raw = record?.data;
      setData({
        title: raw?.title ?? "",
        intro: raw?.intro ?? "",
        sections: Array.isArray(raw?.sections) ? raw.sections : [],
      });
    } catch {
      setError("Could not load content.");
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [slug, locale]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setField = (field: "title" | "intro", val: string) => setData((d) => ({ ...d, [field]: val }));

  const addSection = () => setData((d) => ({ ...d, sections: [...d.sections, { title: "", body: "" }] }));
  const removeSection = (i: number) => setData((d) => ({ ...d, sections: d.sections.filter((_, idx) => idx !== i) }));
  const setSectionTitle = (i: number, val: string) =>
    setData((d) => ({ ...d, sections: d.sections.map((s, idx) => (idx === i ? { ...s, title: val } : s)) }));
  const setSectionBody = (i: number, val: string) =>
    setData((d) => ({ ...d, sections: d.sections.map((s, idx) => (idx === i ? { ...s, body: val } : s)) }));
  const moveSection = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    setData((d) => {
      const sections = [...d.sections];
      [sections[i], sections[j]] = [sections[j], sections[i]];
      return { ...d, sections };
    });
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.put(`/next-api/admin/content/${slug}/${locale}`, data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Could not save content.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.editor}>
      {/* ── Page tabs ── */}
      <div className={styles.pageTabs}>
        {PAGES.map((p) => (
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

      {/* ── Locale switcher ── */}
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
        <span className={styles.localeNote}>Editing overrides the built-in page text when saved</span>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className={styles.loadingRow}>Loading…</div>
      ) : (
        <div className={styles.fields}>
          <label className={styles.fieldLabel}>
            Page title
            <input className={styles.fieldInput} value={data.title} onChange={(e) => setField("title", e.target.value)} placeholder="Page title" />
          </label>

          <label className={styles.fieldLabel}>
            Intro / summary
            <textarea
              className={styles.fieldTextarea}
              value={data.intro}
              onChange={(e) => setField("intro", e.target.value)}
              placeholder="Short introduction shown below the title"
              rows={3}
            />
          </label>

          <div className={styles.sectionsHeader}>
            <span className={styles.sectionsTitle}>Sections</span>
            <button type="button" className={styles.addSectionBtn} onClick={addSection}>+ Add section</button>
          </div>

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
