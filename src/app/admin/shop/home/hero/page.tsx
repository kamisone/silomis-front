"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleDot, Image as ImageIcon, Loader2, Plus, Timer } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { useToast } from "@/components/toast/ToastContext";
import SlideCard, { type HeroSlide } from "./SlideCard";
import { stripHtml } from "@/lib/html";
import styles from "./HeroSlides.module.css";

const BASE = "/next-api/admin/shop/hero-slides";

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export default function HeroSlidesPage() {
  const { toast } = useToast();
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Which slides still hold uncommitted keystrokes, so the bar can say so.
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  // Requests in flight, in a ref rather than state: Save has to *await* them,
  // and an async closure can't read a state value that changed after it started.
  const inFlight = useRef(0);
  const failedSinceSave = useRef(false);

  const setDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyIds((ids) => (dirty ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id)));
  }, []);

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
    inFlight.current += 1;
    setSaving(true);
    try {
      const updated = await api.patch<HeroSlide>(`${BASE}/${id}`, body);
      setSlides((list) => list.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      failedSinceSave.current = true;
      toast.error(errMessage(err, "Failed to save slide"));
      await load();
    } finally {
      inFlight.current -= 1;
      if (inFlight.current === 0) setSaving(false);
    }
  }

  /**
   * Every field on this page commits when it loses focus, so Save's real job is
   * to take focus off whatever is being typed and then wait for the requests
   * that follow. It confirms rather than initiates — which is the honest thing
   * for a page that has already been saving all along, and answers the question
   * the button exists to answer: "did that land?"
   */
  async function saveNow() {
    failedSinceSave.current = false;
    (document.activeElement as HTMLElement | null)?.blur();
    // One tick for the blur's commit to dispatch, then wait it out — bounded,
    // so a request that never settles leaves the button usable rather than
    // spinning forever.
    await new Promise((r) => setTimeout(r, 90));
    const deadline = Date.now() + 10_000;
    while (inFlight.current > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 90));
    }
    if (failedSinceSave.current || inFlight.current > 0) return;
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2400);
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
        content: "<h2>New slide</h2>",
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
    if (!confirm(`Delete the slide "${stripHtml(slide.content) || "Untitled"}"?`)) return;
    setSaving(true);
    try {
      await api.delete(`${BASE}/${slide.id}`);
      setSlides((list) => list.filter((s) => s.id !== slide.id));
      setDirty(slide.id, false);
      toast.success("Slide deleted");
    } catch (err) {
      toast.error(errMessage(err, "Failed to delete slide"));
    } finally {
      setSaving(false);
    }
  }

  const visibleCount = slides.filter((s) => s.isActive).length;
  const hasUnsaved = dirtyIds.length > 0;
  const stateClass = saving
    ? styles.saveStateBusy
    : hasUnsaved
      ? styles.saveStateDirty
      : styles.saveStateClean;

  return (
    <div className={ui.page}>
      {/* Sticky under AdminTopBar: on a page of tall slide cards, Add slide and
          the save state have to stay reachable from anywhere in the scroll. */}
      <div className={`${ui.pageHeader} ${styles.stickyHeader}`}>
        <div className={styles.headerTitle}>
          <Link href="/admin/shop/home" className={styles.backLink}>
            <ArrowLeft size={13} strokeWidth={2.25} />
            Home page
          </Link>
          <h1 className={ui.pageTitle}>Hero carousel</h1>
        </div>

        <div className={styles.headerActions}>
          <span className={`${styles.saveState} ${stateClass}`} role="status" aria-live="polite">
            {saving ? (
              <Loader2 size={12} strokeWidth={2.5} className={styles.spin} />
            ) : hasUnsaved ? (
              <CircleDot size={12} strokeWidth={2.5} />
            ) : (
              <Check size={12} strokeWidth={3} />
            )}
            {saving ? "Saving…" : hasUnsaved ? "Unsaved changes" : justSaved ? "Saved" : "All changes saved"}
          </span>

          <Button variant="secondary" onClick={addSlide} disabled={saving}>
            <Plus size={14} strokeWidth={2.25} />
            Add slide
          </Button>
          <Button onClick={saveNow} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <p className={styles.pageHint}>
        The first thing a visitor sees. Slides play in this order — add a picture for a banner, or leave it empty for a
        text slide on the brand gradient. Each slide is an eyebrow, one rich-text card and its buttons — write them in
        English, then hit Generate on a field to fill the other six languages. Fields save as you leave them; Save just
        commits whatever you are typing right now.
      </p>

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
                One slide — the hero renders static, with no arrows and nothing to swipe.
              </span>
            ) : (
              <span className={styles.statusNote}>
                <Timer size={12} strokeWidth={2.25} />
                Rotates every 5 seconds, pausing while a visitor hovers it.
              </span>
            )}
          </div>

          <ol className={styles.stack}>
            {slides.map((slide, index) => (
              <SlideCard
                key={slide.id}
                slide={slide}
                index={index}
                total={slides.length}
                saving={saving}
                onPatch={patchSlide}
                onMove={move}
                onDelete={removeSlide}
                onError={(message) => toast.error(message)}
                onDirtyChange={setDirty}
              />
            ))}
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
