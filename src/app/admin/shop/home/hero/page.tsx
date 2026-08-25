"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Image as ImageIcon, Plus, Timer, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { useToast } from "@/components/toast/ToastContext";
import SlidePreview from "./SlidePreview";
import styles from "./HeroSlides.module.css";

interface HeroSlide {
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

/** The free-text fields, all edited the same way: draft on change, save on blur. */
type TextField =
  | "imageAlt"
  | "eyebrow"
  | "title"
  | "subtitle"
  | "ctaLabel"
  | "ctaHref"
  | "ctaSecondaryLabel"
  | "ctaSecondaryHref";

const BASE = "/next-api/admin/shop/hero-slides";

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export default function HeroSlidesPage() {
  const { toast } = useToast();
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  // Unsaved keystrokes, keyed by slide id. Lets the preview follow what is being
  // typed instead of lagging a round-trip behind.
  const [drafts, setDrafts] = useState<Record<string, Partial<HeroSlide>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // No synchronous setState: `loading` starts true and the first write lands
  // after the await. Mirrors the home-sections page.
  async function load() {
    try {
      setSlides(await api.get<HeroSlide[]>(BASE));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patchSlide(id: string, body: Partial<HeroSlide>) {
    setSaving(true);
    try {
      const updated = await api.patch<HeroSlide>(`${BASE}/${id}`, body);
      setSlides((list) => list.map((s) => (s.id === id ? updated : s)));
      // The saved value now lives in `slides`, so drop the draft rather than
      // letting a stale keystroke keep shadowing it.
      setDrafts((d) => {
        if (!(id in d)) return d;
        const rest = { ...d };
        delete rest[id];
        return rest;
      });
    } catch (err) {
      toast.error(errMessage(err, "Failed to save slide"));
      await load();
    } finally {
      setSaving(false);
    }
  }

  function setDraft(id: string, field: TextField, value: string) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  }

  /** Saves on blur, and only when the value actually changed — so tabbing
   *  through a slide doesn't fire eight pointless requests. */
  function commit(slide: HeroSlide, field: TextField, raw: string) {
    const value = raw.trim();
    const current = (slide[field] as string | null) ?? "";
    if (value === current) return;
    if (field === "title" && !value) {
      toast.error("A slide needs a title");
      setDrafts((d) => ({ ...d, [slide.id]: { ...d[slide.id], title: slide.title } }));
      return;
    }
    patchSlide(slide.id, { [field]: value || null } as Partial<HeroSlide>);
  }

  /** Optimistic reorder, persisted in one call; a failure reloads so the list
   *  can't drift from what's stored. */
  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    setSlides(next);
    setSaving(true);
    try {
      await api.patch(`${BASE}/reorder`, { ids: next.map((s) => s.id) });
    } catch (err) {
      toast.error(errMessage(err, "Failed to reorder slides"));
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function addSlide() {
    setSaving(true);
    try {
      // Created hidden so a half-filled slide can never land on the live site.
      const created = await api.post<HeroSlide>(BASE, {
        title: "New slide",
        isActive: false,
        ctaLabel: "Shop now",
        ctaHref: "/shop",
      });
      setSlides((list) => [...list, created]);
      toast.success("Slide added — fill it in, then switch it on");
    } catch (err) {
      toast.error(errMessage(err, "Failed to add slide"));
    } finally {
      setSaving(false);
    }
  }

  async function removeSlide(slide: HeroSlide) {
    if (!confirm(`Delete the slide "${slide.title}"?`)) return;
    setSaving(true);
    try {
      await api.delete(`${BASE}/${slide.id}`);
      setSlides((list) => list.filter((s) => s.id !== slide.id));
      toast.success("Slide deleted");
    } catch (err) {
      toast.error(errMessage(err, "Failed to delete slide"));
    } finally {
      setSaving(false);
    }
  }

  const visibleCount = slides.filter((s) => s.isActive).length;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <Link href="/admin/shop/home" className={styles.backLink}>
            <ArrowLeft size={13} strokeWidth={2.25} />
            Home page
          </Link>
          <h1 className={ui.pageTitle}>Hero carousel</h1>
          <p className={styles.pageHint}>
            The first thing a visitor sees. Slides play in this order — add a picture for a banner, or leave it empty
            for a text slide on the brand gradient.
          </p>
        </div>
        <Button onClick={addSlide} disabled={saving}>
          <Plus size={14} strokeWidth={2.25} />
          Add slide
        </Button>
      </div>

      {loading ? (
        <div className={ui.card}>
          <div className={ui.emptyState}>Loading…</div>
        </div>
      ) : slides.length === 0 ? (
        <div className={`${ui.card} ${styles.empty}`}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <ImageIcon size={26} strokeWidth={1.6} />
          </span>
          <p className={styles.emptyTitle}>No slides yet</p>
          <p className={styles.emptyBody}>
            The hero is showing the built-in welcome message. Add a slide to take it over — one slide renders as a
            static hero, two or more start rotating.
          </p>
          <Button onClick={addSlide} disabled={saving}>
            <Plus size={14} strokeWidth={2.25} />
            Add the first slide
          </Button>
        </div>
      ) : (
        <>
          <div className={styles.statusBar}>
            <span className={styles.statusCount}>
              <strong>{slides.length}</strong> slide{slides.length === 1 ? "" : "s"} · <strong>{visibleCount}</strong>{" "}
              visible
            </span>
            {/* What the visitor will actually experience, stated plainly — the
                behaviour changes at one slide vs. several, and that surprises
                people who only ever see the editor. */}
            {visibleCount === 0 ? (
              <span className={styles.statusWarn}>All slides hidden — the hero falls back to the built-in message.</span>
            ) : visibleCount === 1 ? (
              <span className={styles.statusNote}>
                <Timer size={12} strokeWidth={2.25} />
                One slide — the hero renders static, with no arrows or dots.
              </span>
            ) : (
              <span className={styles.statusNote}>
                <Timer size={12} strokeWidth={2.25} />
                Rotates every 5 seconds, pausing while a visitor hovers it.
              </span>
            )}
          </div>

          <ol className={styles.stack}>
            {slides.map((slide, index) => {
              const view = { ...slide, ...drafts[slide.id] };
              const dirty = !!drafts[slide.id];
              return (
                <li key={slide.id} className={`${styles.card} ${slide.isActive ? "" : styles.cardOff}`}>
                  {/* Position rail: the number is the play order, the arrows move it. */}
                  <div className={styles.rail}>
                    <span className={styles.railNum}>{index + 1}</span>
                    <button
                      type="button"
                      className={styles.moveBtn}
                      onClick={() => move(index, -1)}
                      disabled={index === 0 || saving}
                      aria-label={`Move slide ${index + 1} earlier`}
                    >
                      <ArrowUp size={13} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      className={styles.moveBtn}
                      onClick={() => move(index, 1)}
                      disabled={index === slides.length - 1 || saving}
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
                        {dirty && <span className={styles.pillDirty}>Unsaved</span>}
                      </div>

                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={`${styles.toggle} ${slide.isActive ? styles.toggleOn : ""}`}
                          onClick={() => patchSlide(slide.id, { isActive: !slide.isActive })}
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
                          onClick={() => removeSlide(slide)}
                          disabled={saving}
                          aria-label={`Delete slide ${index + 1}`}
                          title="Delete this slide"
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </div>

                    <div className={styles.cardBody}>
                      {/* Preview and its image control sit together: the picture is
                          the thing the preview is mostly about. */}
                      <div className={styles.previewCol}>
                        <SlidePreview slide={view} />
                        <div className={styles.mediaRow}>
                          <MediaPicker
                            value={slide.imageKey}
                            previewUrl={slide.imageUrl}
                            mediaType="image"
                            label="banner image"
                            asAddTile
                            className={styles.mediaTile}
                            onChange={(storageKey) => patchSlide(slide.id, { imageKey: storageKey })}
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
                            <label className={`${styles.field} ${styles.fieldThird}`}>
                              <span className={styles.fieldLabel}>Eyebrow</span>
                              <input
                                className={ui.input}
                                value={view.eyebrow ?? ""}
                                placeholder="New season"
                                onChange={(e) => setDraft(slide.id, "eyebrow", e.target.value)}
                                onBlur={(e) => commit(slide, "eyebrow", e.target.value)}
                                disabled={saving}
                              />
                            </label>
                            <label className={`${styles.field} ${styles.fieldTwoThirds}`}>
                              <span className={styles.fieldLabel}>
                                Title <span className={styles.req}>required</span>
                              </span>
                              <input
                                className={ui.input}
                                value={view.title}
                                placeholder="Welcome to Silomis"
                                onChange={(e) => setDraft(slide.id, "title", e.target.value)}
                                onBlur={(e) => commit(slide, "title", e.target.value)}
                                disabled={saving}
                              />
                            </label>
                            <label className={styles.field}>
                              <span className={styles.fieldLabel}>Subtitle</span>
                              <textarea
                                className={ui.textarea}
                                rows={2}
                                value={view.subtitle ?? ""}
                                placeholder="Quality products, delivered to your door."
                                onChange={(e) => setDraft(slide.id, "subtitle", e.target.value)}
                                onBlur={(e) => commit(slide, "subtitle", e.target.value)}
                                disabled={saving}
                              />
                            </label>
                            {slide.imageKey && (
                              <label className={styles.field}>
                                <span className={styles.fieldLabel}>Image description</span>
                                <input
                                  className={ui.input}
                                  value={view.imageAlt ?? ""}
                                  placeholder="Describes the picture for screen readers"
                                  onChange={(e) => setDraft(slide.id, "imageAlt", e.target.value)}
                                  onBlur={(e) => commit(slide, "imageAlt", e.target.value)}
                                  disabled={saving}
                                />
                              </label>
                            )}
                          </div>
                        </fieldset>

                        <fieldset className={styles.group}>
                          <legend className={styles.groupTitle}>Buttons</legend>
                          <div className={styles.groupBody}>
                            <div className={styles.ctaRow}>
                              <span className={styles.ctaBadgePrimary}>Main</span>
                              <label className={styles.field}>
                                <span className={styles.fieldLabel}>Label</span>
                                <input
                                  className={ui.input}
                                  value={view.ctaLabel ?? ""}
                                  placeholder="Shop now"
                                  onChange={(e) => setDraft(slide.id, "ctaLabel", e.target.value)}
                                  onBlur={(e) => commit(slide, "ctaLabel", e.target.value)}
                                  disabled={saving}
                                />
                              </label>
                              <label className={styles.field}>
                                <span className={styles.fieldLabel}>Links to</span>
                                <input
                                  className={ui.input}
                                  value={view.ctaHref ?? ""}
                                  placeholder="/shop"
                                  onChange={(e) => setDraft(slide.id, "ctaHref", e.target.value)}
                                  onBlur={(e) => commit(slide, "ctaHref", e.target.value)}
                                  disabled={saving}
                                />
                              </label>
                            </div>
                            <div className={styles.ctaRow}>
                              <span className={styles.ctaBadgeSecondary}>Second</span>
                              <label className={styles.field}>
                                <span className={styles.fieldLabel}>Label</span>
                                <input
                                  className={ui.input}
                                  value={view.ctaSecondaryLabel ?? ""}
                                  placeholder="Browse collections"
                                  onChange={(e) => setDraft(slide.id, "ctaSecondaryLabel", e.target.value)}
                                  onBlur={(e) => commit(slide, "ctaSecondaryLabel", e.target.value)}
                                  disabled={saving}
                                />
                              </label>
                              <label className={styles.field}>
                                <span className={styles.fieldLabel}>Links to</span>
                                <input
                                  className={ui.input}
                                  value={view.ctaSecondaryHref ?? ""}
                                  placeholder="/collections"
                                  onChange={(e) => setDraft(slide.id, "ctaSecondaryHref", e.target.value)}
                                  onBlur={(e) => commit(slide, "ctaSecondaryHref", e.target.value)}
                                  disabled={saving}
                                />
                              </label>
                            </div>
                            <p className={styles.groupNote}>
                              A button appears only when it has both a label and a link. Use storefront paths without a
                              language prefix — <code>/shop</code>, <code>/collections/summer</code> — or a full
                              https:// address. Changes save as you leave each field.
                            </p>
                          </div>
                        </fieldset>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <button type="button" className={styles.addCard} onClick={addSlide} disabled={saving}>
            <Plus size={16} strokeWidth={2.5} />
            Add slide
          </button>
        </>
      )}
    </div>
  );
}
