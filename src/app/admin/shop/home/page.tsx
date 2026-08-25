"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Images, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { useToast } from "@/components/toast/ToastContext";
import {
  DEFAULT_HOME_SECTIONS,
  HOME_SECTION_TYPES,
  SECTION_DEFAULT_LIMIT,
  SECTION_META,
  isEmptyText,
  localized,
  newSectionConfig,
  type HomeSectionConfig,
  type HomeSectionType,
  type LocalizedText,
} from "@/components/home/sectionTypes";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";
import SectionPreview from "./SectionPreview";
import SectionSettings from "./SectionSettings";
import styles from "./HomeSections.module.css";

interface HomeSection {
  id: string;
  type: HomeSectionType;
  sortOrder: number;
  isActive: boolean;
  config: HomeSectionConfig;
}

const BASE = "/next-api/admin/shop/home-sections";

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

const SEPARATOR_TONE_LABEL = { plain: "Empty space", tint: "Tinted band", line: "Hairline rule" } as const;
const SEPARATOR_HEIGHT_LABEL = { sm: "small", md: "medium", lg: "large" } as const;

/** Which languages a block has been written in — the question an editor asks
 *  about copy that lives in seven of them. */
function languageSummary(...texts: Array<LocalizedText | null | undefined>): string | null {
  const written = LOCALES.filter((l) =>
    texts.some((text) => (typeof text === "string" ? l === DEFAULT_LOCALE && !!text.trim() : !!text?.[l]?.trim())),
  );
  if (written.length === 0) return null;
  if (written.length === LOCALES.length) return "all languages";
  return written.map((l) => l.toUpperCase()).join(", ");
}

/** One-line summary of a section's settings, shown in the card header so the
 *  admin can scan the whole page without opening anything. */
function settingsSummary(section: HomeSection): string | null {
  const parts: string[] = [];
  const { config } = section;

  if (section.type === "product_rail") {
    parts.push(config.source === "featured" ? "Featured products" : "Newest first");
    if (config.title?.trim()) parts.push(`“${config.title.trim()}”`);
  }

  if (section.type === "section_heading") {
    const title = localized(config.heading, DEFAULT_LOCALE);
    parts.push(title ? `“${title}”` : "No title yet");
    if (config.align === "center") parts.push("centred");
    if (config.tinted) parts.push("tinted");
    const langs = languageSummary(config.eyebrow, config.heading, config.subtitle);
    if (langs) parts.push(langs);
  }

  if (section.type === "separator") {
    parts.push(SEPARATOR_TONE_LABEL[config.tone ?? "plain"]);
    parts.push(`${SEPARATOR_HEIGHT_LABEL[config.height ?? "md"]} gap`);
    if (config.flipTint) parts.push("restarts the banding");
  }

  if (section.type === "seo_text") {
    const title = localized(config.heading, DEFAULT_LOCALE);
    if (title) parts.push(`“${title}”`);
    if (isEmptyText(config.body)) parts.push("Nothing written yet");
    else {
      const langs = languageSummary(config.heading, config.body);
      if (langs) parts.push(langs);
    }
  }

  const limit = config.limit ?? SECTION_DEFAULT_LIMIT[section.type];
  if (limit && SECTION_META[section.type].fields.includes("limit")) parts.push(`${limit} items`);
  return parts.length ? parts.join(" · ") : null;
}

export default function HomeSectionsPage() {
  const { toast } = useToast();
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  // No synchronous setState: `loading` starts true and the first write lands
  // after the await. Re-fetches from error paths are covered by `saving`.
  async function load() {
    try {
      setSections(await api.get<HomeSection[]>(BASE));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /** True while the table is empty: the storefront is rendering its built-in
   *  default layout and nothing here has been customized yet. */
  const usingDefaults = !loading && sections.length === 0;
  const visibleCount = sections.filter((s) => s.isActive).length;

  async function patchSection(id: string, body: Partial<Pick<HomeSection, "isActive" | "config">>) {
    setSaving(true);
    try {
      const updated = await api.patch<HomeSection>(`${BASE}/${id}`, body);
      setSections((list) => list.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      toast.error(errMessage(err, "Failed to save section"));
      await load();
    } finally {
      setSaving(false);
    }
  }

  /** Optimistic: the list reorders immediately, then persists. A failed save
   *  reloads from the server so the UI can't drift from what's stored. */
  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
    setSaving(true);
    try {
      await api.patch(`${BASE}/reorder`, { ids: next.map((s) => s.id) });
    } catch (err) {
      toast.error(errMessage(err, "Failed to reorder sections"));
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function addSection(type: HomeSectionType) {
    setSaving(true);
    try {
      const created = await api.post<HomeSection>(BASE, {
        type,
        isActive: true,
        config: newSectionConfig(type),
      });
      setSections((list) => [...list, created]);
      setPicking(false);
      toast.success(`${SECTION_META[type].label} added at the bottom`);
    } catch (err) {
      toast.error(errMessage(err, "Failed to add section"));
    } finally {
      setSaving(false);
    }
  }

  async function removeSection(section: HomeSection) {
    if (!confirm(`Remove the "${SECTION_META[section.type].label}" section from the home page?`)) return;
    setSaving(true);
    try {
      await api.delete(`${BASE}/${section.id}`);
      setSections((list) => list.filter((s) => s.id !== section.id));
      toast.success("Section removed");
    } catch (err) {
      toast.error(errMessage(err, "Failed to remove section"));
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefaults() {
    if (sections.length > 0 && !confirm("Replace the current layout with the default one? This cannot be undone.")) return;
    setSaving(true);
    try {
      setSections(await api.post<HomeSection[]>(`${BASE}/restore-defaults`, {}));
      toast.success("Default layout restored");
    } catch (err) {
      toast.error(errMessage(err, "Failed to restore defaults"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.pageTitle}>Home page</h1>
          <p className={styles.pageHint}>
            The storefront home page, top to bottom. Reorder the cards to move blocks up and down the page. A section
            with nothing to show — no featured collections, no active promotion — hides itself automatically.
          </p>
        </div>
        <Button variant="secondary" onClick={restoreDefaults} disabled={saving}>
          <RotateCcw size={14} strokeWidth={2} />
          {usingDefaults ? "Start customizing" : "Restore defaults"}
        </Button>
      </div>

      {loading ? (
        <div className={ui.card}>
          <div className={ui.emptyState}>Loading…</div>
        </div>
      ) : usingDefaults ? (
        <div className={`${ui.card} ${styles.defaults}`}>
          <p className={styles.defaultsTitle}>The home page is using the default layout</p>
          <p className={styles.defaultsBody}>
            These blocks are live right now. Choose <strong>Start customizing</strong> to turn them into cards you can
            reorder, configure, and switch on and off.
          </p>
          <ol className={styles.defaultsStack}>
            {DEFAULT_HOME_SECTIONS.map((section, index) => (
              <li key={`${section.type}-${index}`} className={styles.defaultsRow}>
                <span className={styles.defaultsNum}>{index + 1}</span>
                <SectionPreview type={section.type} />
                <span className={styles.defaultsLabel}>{SECTION_META[section.type].label}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <>
          <div className={styles.statusBar}>
            <span className={styles.statusCount}>
              <strong>{sections.length}</strong> section{sections.length === 1 ? "" : "s"} ·{" "}
              <strong>{visibleCount}</strong> visible
            </span>
            {visibleCount === 0 && <span className={styles.statusWarn}>Every section is hidden — the page is empty.</span>}
          </div>

          <ol className={styles.stack}>
            {sections.map((section, index) => {
              const meta = SECTION_META[section.type];
              if (!meta) return null;
              const summary = settingsSummary(section);
              return (
                <li key={section.id} className={`${styles.card} ${section.isActive ? "" : styles.cardOff}`}>
                  {/* Position rail: the number is the page order, the arrows move it. */}
                  <div className={styles.rail}>
                    <span className={styles.railNum}>{index + 1}</span>
                    <button
                      type="button"
                      className={styles.moveBtn}
                      onClick={() => move(index, -1)}
                      disabled={index === 0 || saving}
                      aria-label={`Move ${meta.label} up`}
                    >
                      <ArrowUp size={13} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      className={styles.moveBtn}
                      onClick={() => move(index, 1)}
                      disabled={index === sections.length - 1 || saving}
                      aria-label={`Move ${meta.label} down`}
                    >
                      <ArrowDown size={13} strokeWidth={2.5} />
                    </button>
                  </div>

                  <div className={styles.cardMain}>
                    <div className={styles.cardHead}>
                      <span className={styles.previewFrame} aria-hidden="true">
                        <SectionPreview type={section.type} />
                      </span>

                      <div className={styles.cardText}>
                        <div className={styles.cardTitleRow}>
                          <h2 className={styles.cardTitle}>{meta.label}</h2>
                          <span className={section.isActive ? styles.pillLive : styles.pillHidden}>
                            {section.isActive ? "Visible" : "Hidden"}
                          </span>
                        </div>
                        <p className={styles.cardDesc}>{meta.description}</p>
                        {summary && <p className={styles.cardSummary}>{summary}</p>}
                        {/* The hero's content is a list of slides, not a couple of
                            fields — it gets its own screen. */}
                        {section.type === "hero" && (
                          <Link href="/admin/shop/home/hero" className={styles.manageLink}>
                            <Images size={13} strokeWidth={2} />
                            Manage carousel slides
                          </Link>
                        )}
                      </div>

                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={`${styles.toggle} ${section.isActive ? styles.toggleOn : ""}`}
                          onClick={() => patchSection(section.id, { isActive: !section.isActive })}
                          disabled={saving}
                          aria-pressed={section.isActive}
                          title={section.isActive ? "Hide this section" : "Show this section"}
                        >
                          {section.isActive ? <Eye size={14} strokeWidth={2} /> : <EyeOff size={14} strokeWidth={2} />}
                          {section.isActive ? "Visible" : "Hidden"}
                        </button>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => removeSection(section)}
                          disabled={saving}
                          aria-label={`Remove ${meta.label}`}
                          title="Remove from the page"
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </div>

                    <SectionSettings
                      type={section.type}
                      config={section.config}
                      saving={saving}
                      onChange={(patch) => patchSection(section.id, { config: { ...section.config, ...patch } })}
                    />

                  </div>
                </li>
              );
            })}
          </ol>

          {/* Add sits at the end of the stack because that is where a new section
              lands on the page — the control mirrors the outcome. */}
          {picking ? (
            <div className={styles.picker}>
              <div className={styles.pickerHead}>
                <span className={styles.pickerTitle}>Add a section</span>
                <button type="button" className={styles.pickerClose} onClick={() => setPicking(false)} aria-label="Cancel">
                  <X size={15} strokeWidth={2.25} />
                </button>
              </div>
              <div className={styles.pickerGrid}>
                {HOME_SECTION_TYPES.map((type) => {
                  const used = sections.some((s) => s.type === type);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={styles.pickerOption}
                      onClick={() => addSection(type)}
                      disabled={saving}
                    >
                      <SectionPreview type={type} />
                      <span className={styles.pickerLabel}>
                        {SECTION_META[type].label}
                        {/* Duplicates are allowed on purpose — two product rails
                            with different sources is the common case. */}
                        {used && (
                          <span className={styles.pickerUsed}>
                            <Check size={11} strokeWidth={3} />
                            on page
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <button type="button" className={styles.addCard} onClick={() => setPicking(true)} disabled={saving}>
              <Plus size={16} strokeWidth={2.5} />
              Add a section
            </button>
          )}
        </>
      )}
    </div>
  );
}
