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
  type HomeSectionConfig,
  type HomeSectionType,
} from "@/components/home/sectionTypes";
import SectionPreview from "./SectionPreview";
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

/** One-line summary of a section's settings, shown in the card header so the
 *  admin can scan the whole page without opening anything. */
function settingsSummary(section: HomeSection): string | null {
  const parts: string[] = [];
  if (section.type === "product_rail") {
    parts.push(section.config.source === "featured" ? "Featured products" : "Newest first");
    if (section.config.title?.trim()) parts.push(`“${section.config.title.trim()}”`);
  }
  const limit = section.config.limit ?? SECTION_DEFAULT_LIMIT[section.type];
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
        config: SECTION_DEFAULT_LIMIT[type] ? { limit: SECTION_DEFAULT_LIMIT[type] } : {},
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

                    {meta.fields.length > 0 && (
                      <div className={styles.settings}>
                        {meta.fields.includes("source") && (
                          <label className={styles.field}>
                            <span className={styles.fieldLabel}>Products</span>
                            <select
                              className={ui.select}
                              value={section.config.source ?? "newest"}
                              onChange={(e) => patchSection(section.id, { config: { ...section.config, source: e.target.value as "newest" | "featured" } })}
                              disabled={saving}
                            >
                              <option value="newest">Newest first</option>
                              <option value="featured">Featured products</option>
                            </select>
                          </label>
                        )}
                        {meta.fields.includes("title") && (
                          <label className={`${styles.field} ${styles.fieldWide}`}>
                            <span className={styles.fieldLabel}>Heading</span>
                            <input
                              className={ui.input}
                              defaultValue={section.config.title ?? ""}
                              placeholder="Leave blank for the translated default"
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (value === (section.config.title ?? "")) return;
                                patchSection(section.id, { config: { ...section.config, title: value || null } });
                              }}
                              disabled={saving}
                            />
                          </label>
                        )}
                        {meta.fields.includes("limit") && (
                          <label className={`${styles.field} ${styles.fieldNarrow}`}>
                            <span className={styles.fieldLabel}>Items</span>
                            <input
                              className={ui.input}
                              type="number"
                              min={1}
                              max={24}
                              defaultValue={section.config.limit ?? SECTION_DEFAULT_LIMIT[section.type] ?? 8}
                              onBlur={(e) => {
                                const value = Number.parseInt(e.target.value, 10);
                                if (!Number.isFinite(value) || value === section.config.limit) return;
                                patchSection(section.id, { config: { ...section.config, limit: Math.min(24, Math.max(1, value)) } });
                              }}
                              disabled={saving}
                            />
                          </label>
                        )}
                        <span className={styles.settingsNote}>Changes save as you leave each field.</span>
                      </div>
                    )}
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
