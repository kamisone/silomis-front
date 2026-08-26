"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, ChevronDown, Eye, EyeOff, Images, Plus, RotateCcw, Settings2, Trash2, X } from "lucide-react";
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
import SectionSettings, {
  EMPTY_CATALOGUE,
  type Catalogue,
  type CatalogueCategory,
  type CatalogueCollection,
  type CatalogueProduct,
  type CataloguePromotion,
} from "./SectionSettings";
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

const RAIL_SOURCE_LABEL = {
  newest: "Newest first",
  featured: "Featured products",
  on_sale: "On sale",
  manual: "Hand-picked",
} as const;

/** "3 products", "1 category" — the count is the useful part, but a bare number
 *  beside a section name reads as ambiguous. */
function countLabel(n: number, noun: string, plural = `${noun}s`): string {
  return `${n} ${n === 1 ? noun : plural}`;
}

/** One-line summary of a section's settings, shown in the card header so the
 *  admin can scan the whole page without opening anything.
 *
 * `catalogue` is only used to name a pinned promotion; every other part of the
 * summary reads from the config alone, so the line is still correct while the
 * catalogue is still loading.
 */
function settingsSummary(section: HomeSection, catalogue: Catalogue): string | null {
  const parts: string[] = [];
  const { config } = section;
  const fields = SECTION_META[section.type].fields;

  // Hand-picked lists describe themselves by their count; an automatic one
  // describes itself by the query that fills it.
  const picked =
    section.type === "product_rail"
      ? (config.source === "manual" ? config.productIds ?? [] : null)
      : section.type === "categories"
        ? (config.categoryIds?.length ? config.categoryIds : null)
        : section.type === "featured_collections"
          ? (config.collectionIds?.length ? config.collectionIds : null)
          : null;

  if (section.type === "product_rail") {
    const source = config.source ?? "newest";
    if (source === "manual") {
      parts.push(picked?.length ? countLabel(picked.length, "product") : "Nothing picked yet");
    } else {
      parts.push(RAIL_SOURCE_LABEL[source]);
    }
  }

  if (section.type === "categories") {
    parts.push(picked ? countLabel(picked.length, "category", "categories") : "Top level, automatic");
  }

  if (section.type === "featured_collections") {
    parts.push(picked ? countLabel(picked.length, "collection") : "Featured, automatic");
  }

  if (section.type === "promo_banner") {
    const pinned = config.promotionId ? catalogue.promotions.find((p) => p.id === config.promotionId) : undefined;
    // A pinned id whose promotion is gone still says "pinned" — the storefront
    // falls back, and calling it automatic here would hide the stale setting.
    parts.push(config.promotionId ? `Pinned: ${pinned?.name ?? "deleted promotion"}` : "Highest priority active");
  }

  if (section.type === "trust_bar") {
    const items = config.trustItems ?? [];
    parts.push(items.length ? countLabel(items.length, "reassurance") : "Built-in four");
  }

  if (fields.includes("title")) {
    const title = localized(config.title, DEFAULT_LOCALE);
    if (title) parts.push(`\u201c${title}\u201d`);
    const langs = languageSummary(config.title);
    if (langs) parts.push(langs);
  }

  if (section.type === "section_heading") {
    const title = localized(config.heading, DEFAULT_LOCALE);
    parts.push(title ? `\u201c${title}\u201d` : "No title yet");
    if (config.iconImageUrl) parts.push("with icon");
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
    if (title) parts.push(`\u201c${title}\u201d`);
    if (isEmptyText(config.body)) parts.push("Nothing written yet");
    else {
      const langs = languageSummary(config.heading, config.body);
      if (langs) parts.push(langs);
    }
  }

  // The cap is only real for an automatic list — a hand-picked one renders
  // exactly what was chosen, so printing a limit beside it would be a lie.
  const limit = config.limit ?? SECTION_DEFAULT_LIMIT[section.type];
  if (limit && fields.includes("limit") && !picked) parts.push(`${limit} items`);

  if (config.viewAllHref) parts.push(`\u2192 ${config.viewAllHref}`);

  return parts.length ? parts.join(" \u00b7 ") : null;
}

export default function HomeSectionsPage() {
  const { toast } = useToast();
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  // Everything the section pickers choose from, loaded once for the whole page
  // rather than per card — a page of eight rails would otherwise fetch the
  // catalogue eight times.
  const [catalogue, setCatalogue] = useState<Catalogue>(EMPTY_CATALOGUE);
  // Settings are collapsed by default. This screen's primary job is arranging
  // the page — eight sections' worth of open forms buries that under a wall of
  // controls, and the header summary already answers "how is this one set up?".
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // No synchronous setState: `loading` starts true and the first write lands
  // after the await. Re-fetches from error paths are covered by `saving`.
  async function load() {
    try {
      setSections(await api.get<HomeSection[]>(BASE));
    } finally {
      setLoading(false);
    }
  }

  /** Best-effort: a picker that cannot load its options still lets the section
   *  run on its automatic source, so this never blocks the page. */
  async function loadCatalogue() {
    const [products, categories, collections, promotions] = await Promise.all([
      api.get<{ items: CatalogueProduct[] }>("/next-api/admin/shop/products?limit=200").catch(() => null),
      api.get<CatalogueCategory[]>("/next-api/admin/shop/categories").catch(() => null),
      api.get<{ items: CatalogueCollection[] }>("/next-api/admin/shop/collections?limit=200").catch(() => null),
      api.get<{ items: CataloguePromotion[] }>("/next-api/admin/shop/promotions?limit=200").catch(() => null),
    ]);
    setCatalogue({
      products: products?.items ?? [],
      categories: categories ?? [],
      collections: collections?.items ?? [],
      promotions: promotions?.items ?? [],
    });
  }

  useEffect(() => {
    // Deferred a tick rather than run in the effect body — same shape the rest
    // of the admin uses, and what keeps these fetches' setState out of the
    // render that scheduled them.
    const t = setTimeout(() => {
      load();
      loadCatalogue();
    }, 0);
    return () => clearTimeout(t);
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
              const summary = settingsSummary(section, catalogue);
              const configurable = meta.fields.length > 0;
              const isOpen = expanded.has(section.id);
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

                    {/* The hero has no inline settings — its content is a list of
                        slides on its own screen — so it gets no disclosure. */}
                    {configurable && (
                      <>
                        <button
                          type="button"
                          className={`${styles.disclosure} ${isOpen ? styles.disclosureOpen : ""}`}
                          onClick={() => toggleExpanded(section.id)}
                          aria-expanded={isOpen}
                          aria-controls={`settings-${section.id}`}
                        >
                          <Settings2 size={13} strokeWidth={2.2} />
                          <span>{isOpen ? "Hide settings" : "Settings"}</span>
                          <ChevronDown size={14} strokeWidth={2.4} className={styles.disclosureChevron} />
                        </button>

                        {isOpen && (
                          <div id={`settings-${section.id}`} className={styles.settingsWrap}>
                            <SectionSettings
                              type={section.type}
                              config={section.config}
                              catalogue={catalogue}
                              saving={saving}
                              onChange={(patch) =>
                                patchSection(section.id, { config: { ...section.config, ...patch } })
                              }
                            />
                            <p className={styles.settingsNote}>Changes save as you leave each field.</p>
                          </div>
                        )}
                      </>
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
                <span className={styles.pickerTitle}>
                  Add a section
                  <span className={styles.pickerSub}>It lands at the bottom — move it up from there.</span>
                </span>
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
                      <span className={styles.pickerDesc}>{SECTION_META[type].description}</span>
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
