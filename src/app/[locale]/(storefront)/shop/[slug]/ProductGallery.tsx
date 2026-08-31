"use client";

import Image from "next/image";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, Maximize2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import GalleryVideo from "./GalleryVideo";
import styles from "./ProductGallery.module.css";

export interface GalleryMediaItem {
  type:             "image" | "video";
  url:              string;
  /** HLS master playlist URL — set when the video has a transcoded rendition */
  hlsUrl?:          string | null;
  posterUrl?:       string | null;
  alt?:             string;
  durationSeconds?: number | null;
}

interface Props {
  media: GalleryMediaItem[];
  title: string;
  /** Parent sets this true when the hero has been scrolled past — triggers the mini floating viewer */
  compact?: boolean;
  /**
   * The URL of the slide to jump to whenever it changes (e.g. a new variant
   * was picked) — looked up by URL within `media` rather than assuming
   * index 0. Falls back to index 0 when null/not found.
   */
  focusUrl?: string | null;
}

/** Formats a duration in seconds as "m:ss". */
function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Thumbnail content for a media item — poster/frame + play badge + duration for videos.
 *  Exported so both the vertical thumb strip and the horizontal mobile strip
 *  below the gallery can reuse the exact same thumbnail visuals. */
export function MediaThumb({ item, sizes }: { item: GalleryMediaItem; sizes: string }) {
  if (item.type === "video") {
    return (
      <>
        {item.posterUrl ? (
          <Image src={item.posterUrl} alt="" fill sizes={sizes} className={styles.thumbImg} />
        ) : (
          <video src={item.url} className={styles.thumbVideo} muted preload="metadata" />
        )}
        <div className={styles.playIconBadge} aria-hidden="true"><span><Play size={12} fill="#fff" /></span></div>
        {item.durationSeconds != null && (
          <div className={styles.durationBadge}>{formatDuration(item.durationSeconds)}</div>
        )}
      </>
    );
  }
  return <Image src={item.url} alt="" fill sizes={sizes} className={styles.thumbImg} />;
}

/**
 * Brings a thumbnail into view by scrolling ONLY its strip.
 *
 * Deliberately not `scrollIntoView`: that walks up the tree and scrolls every
 * scrollable ancestor, the document included. `block`/`inline: "nearest"` only
 * minimises how far each one scrolls — it does not confine the scrolling to one
 * container. So with the gallery above the viewport (the shopper has scrolled
 * down to where the sticky buy bar shows), picking a variant there moved
 * `current`, and bringing the newly active thumbnail into view dragged the
 * whole page back up to the gallery.
 *
 * Comparing the two rects and scrolling the strip by the difference reproduces
 * exactly what "nearest" was wanted for, and cannot touch the page scroll.
 * `behavior` is left to the strips' own `scroll-behavior: smooth` in CSS, which
 * already backs off under prefers-reduced-motion.
 */
function revealInStrip(strip: HTMLElement, child: HTMLElement | undefined, axis: "x" | "y"): void {
  // A strip hidden at this breakpoint has no box to measure against.
  if (!child || !child.offsetParent) return;

  const s = strip.getBoundingClientRect();
  const c = child.getBoundingClientRect();

  if (axis === "x") {
    const delta = c.left < s.left ? c.left - s.left : c.right > s.right ? c.right - s.right : 0;
    if (delta !== 0) strip.scrollBy({ left: delta });
  } else {
    const delta = c.top < s.top ? c.top - s.top : c.bottom > s.bottom ? c.bottom - s.bottom : 0;
    if (delta !== 0) strip.scrollBy({ top: delta });
  }
}

export interface ProductGalleryHandle {
  /** Jumps the main viewer to `index` and opens the fullscreen lightbox there —
   *  used by a desktop big-thumbnails grid so it opens "the same carousel". */
  openAt: (index: number) => void;
}

const ProductGallery = forwardRef<ProductGalleryHandle, Props>(function ProductGallery({ media, title, compact, focusUrl }, ref) {
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [mounted, setMounted]  = useState(false);
  // Whether the vertical thumbnail strip has hidden thumbs above / below the
  // current scroll position — drives the fade cue and the edge chevrons.
  const [canScrollUp, setCanScrollUp]     = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  // Horizontal strip (mobile): arrow-driven paging, no hover auto-scroll.
  const [mobileOverflow, setMobileOverflow]   = useState(false);
  const [canScrollLeft, setCanScrollLeft]     = useState(false);
  const [canScrollRight, setCanScrollRight]   = useState(false);
  const touchStartX = useRef<number | null>(null);
  const stripRef       = useRef<HTMLDivElement>(null);
  const mobileStripRef = useRef<HTMLDivElement>(null);
  const mainImageRef   = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<number | null>(null);
  const mainScrollSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True while a *programmatic* scroll (variant/hero reset, dot/thumbnail
  // click, keyboard) is animating the main image container — the swipe-sync
  // debounce below ignores every scroll event outright while this is set, so
  // the reset's own smooth-scroll animation can't clobber `current` with a
  // stale, in-flight scroll position right after the reset lands.
  const isProgrammaticScrollRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  // Recompute whether the strip can still scroll up/down. Cheap; runs on scroll,
  // resize, and whenever the media set changes.
  const syncScrollCues = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const EPS = 2; // absorb sub-pixel rounding so the cue doesn't flicker at the ends
    setCanScrollUp(el.scrollTop > EPS);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - EPS);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  // Continuously glide the strip while the cursor rests on an edge chevron, so
  // hovering the bottom reveals the hidden thumbnails without any click.
  const startAutoScroll = useCallback((dir: 1 | -1) => {
    stopAutoScroll();
    const SPEED = 8; // px per frame — smooth but unhurried
    const step = () => {
      const el = stripRef.current;
      if (!el) return;
      el.scrollTop += dir * SPEED;
      const atEnd = dir === 1
        ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1
        : el.scrollTop <= 0;
      if (atEnd) { autoScrollRef.current = null; return; }
      autoScrollRef.current = requestAnimationFrame(step);
    };
    autoScrollRef.current = requestAnimationFrame(step);
  }, [stopAutoScroll]);

  // Keyboard / tap fallback: nudge by roughly two thumbnails.
  const nudgeStrip = useCallback((dir: 1 | -1) => {
    stripRef.current?.scrollBy({ top: dir * 168, behavior: "smooth" });
  }, []);

  // Mobile: whether the horizontal strip overflows and in which directions.
  const syncMobileCues = useCallback(() => {
    const el = mobileStripRef.current;
    if (!el) return;
    const EPS = 2;
    setMobileOverflow(el.scrollWidth - el.clientWidth > EPS);
    setCanScrollLeft(el.scrollLeft > EPS);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - EPS);
  }, []);

  // Mobile arrows page by ~75% of the visible width, one tap at a time.
  const pageMobileStrip = useCallback((dir: 1 | -1) => {
    const el = mobileStripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: "smooth" });
  }, []);

  const goTo = useCallback((index: number) => {
    if (index === current || !media.length) return;
    setCurrent(index);
  }, [current, media.length]);

  const prev = useCallback(() => goTo((current - 1 + media.length) % media.length), [current, goTo, media.length]);
  const next = useCallback(() => goTo((current + 1) % media.length), [current, goTo, media.length]);

  useImperativeHandle(ref, () => ({
    openAt: (index: number) => {
      goTo(index);
      setLightbox(true);
    },
  }), [goTo]);

  // Jump to whichever slide matches focusUrl whenever it changes (e.g. a new
  // variant/swatch was selected) — looked up by URL rather than assumed to
  // be index 0. No-ops when there's no focus target or the url isn't present
  // in this media set. Also cancels any debounced scroll-position sync still
  // pending from a swipe on the *previous* media set (see onMainImageScroll
  // below): covers the edge case where `current` is already at the target
  // index (so the reverse-sync effect, which is what normally arms
  // isProgrammaticScrollRef, doesn't re-run) but a stale timer from an
  // in-progress swipe gesture is still ticking and would otherwise clobber it.
  useEffect(() => {
    if (!focusUrl) return;
    const idx = media.findIndex(m => m.url === focusUrl);
    if (idx < 0) return;
    if (mainScrollSyncTimer.current) {
      clearTimeout(mainScrollSyncTimer.current);
      mainScrollSyncTimer.current = null;
    }
    const t = setTimeout(() => setCurrent(idx), 0);
    return () => clearTimeout(t);
  }, [focusUrl, media]);

  // Scroll the thumbnail strip to keep the active thumb visible
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    revealInStrip(strip, strip.children[current] as HTMLElement | undefined, "y");
  }, [current]);

  // Same, for the mobile horizontal thumbnail strip — otherwise swiping the
  // main image (or tapping a dot) can leave the selected thumbnail scrolled
  // out of view in its own row.
  useEffect(() => {
    const strip = mobileStripRef.current;
    if (!strip) return;
    revealInStrip(strip, strip.children[current] as HTMLElement | undefined, "x");
  }, [current]);

  // Keep the "more thumbnails" cues in sync with the strip's scroll position and
  // size. ResizeObserver covers viewport/layout changes; the media dependency
  // re-measures when the thumbnail count changes (e.g. a new variant's media).
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    syncScrollCues();
    strip.addEventListener("scroll", syncScrollCues, { passive: true });
    const ro = new ResizeObserver(syncScrollCues);
    ro.observe(strip);
    return () => {
      strip.removeEventListener("scroll", syncScrollCues);
      ro.disconnect();
    };
  }, [syncScrollCues, media.length]);

  // Same cue-syncing for the mobile horizontal strip.
  useEffect(() => {
    const strip = mobileStripRef.current;
    if (!strip) return;
    syncMobileCues();
    strip.addEventListener("scroll", syncMobileCues, { passive: true });
    const ro = new ResizeObserver(syncMobileCues);
    ro.observe(strip);
    return () => {
      strip.removeEventListener("scroll", syncMobileCues);
      ro.disconnect();
    };
  }, [syncMobileCues, media.length]);

  // Mobile native-scroll main image (see .mainImage/.slideLayer in the CSS,
  // ≤900px): sync `current` FROM scroll position once the swipe settles.
  // Debounced rather than live so a mid-gesture scroll position — which
  // legitimately sits between two slides while the finger is still moving —
  // doesn't flicker `current` back and forth before scroll-snap settles it.
  // No-ops on desktop, where the container never actually overflows.
  const onMainImageScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    const el = mainImageRef.current;
    if (!el || el.clientWidth === 0) return;
    if (mainScrollSyncTimer.current) clearTimeout(mainScrollSyncTimer.current);
    mainScrollSyncTimer.current = setTimeout(() => {
      if (isProgrammaticScrollRef.current) return;
      const index = Math.round(el.scrollLeft / el.clientWidth);
      setCurrent(prev => (index !== prev && index >= 0 && index < media.length ? index : prev));
    }, 120);
  }, [media.length]);

  useEffect(() => {
    const el = mainImageRef.current;
    if (!el) return;
    el.addEventListener("scroll", onMainImageScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onMainImageScroll);
      if (mainScrollSyncTimer.current) clearTimeout(mainScrollSyncTimer.current);
    };
  }, [onMainImageScroll]);

  // The reverse direction: scroll the container TO `current` when it changes
  // for a reason other than the user's own swipe (dot/thumbnail click,
  // keyboard, variant change resetting to slide 0). Skipped when the
  // container is already close to that position, so it never fights a native
  // scroll gesture that's still settling. Marks the scroll as programmatic
  // for its whole duration (see isProgrammaticScrollRef / onMainImageScroll
  // above) so the swipe-sync debounce can't misread an in-flight scroll
  // position generated by this animation itself and overwrite `current`
  // with the wrong slide right after this effect set it correctly.
  useEffect(() => {
    const el = mainImageRef.current;
    if (!el || el.clientWidth === 0) return;
    const target = current * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) <= 4) {
      isProgrammaticScrollRef.current = false;
      return;
    }

    isProgrammaticScrollRef.current = true;
    const clear = () => { isProgrammaticScrollRef.current = false; };
    el.addEventListener("scrollend", clear, { once: true });
    // Fallback for browsers without `scrollend` support, or on the off
    // chance it never fires — generous enough for any realistic scroll
    // distance; clearing an already-cleared flag is a harmless no-op.
    const fallback = setTimeout(clear, 500);
    el.scrollTo({ left: target, behavior: mounted ? "smooth" : "auto" });

    return () => {
      el.removeEventListener("scrollend", clear);
      clearTimeout(fallback);
    };
  }, [current, mounted]);

  // Re-align instantly (no animation) on resize/orientation change — the
  // effect above only re-runs when `current` itself changes, so without this
  // a device rotation would leave the scroll position mismatched against the
  // now-different slide width until the next navigation.
  useEffect(() => {
    const el = mainImageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === 0) return;
      el.scrollTo({ left: current * el.clientWidth, behavior: "auto" });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [current]);

  // Never leave an animation frame pending after unmount.
  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  // Keyboard navigation (active when lightbox is open)
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") setLightbox(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, prev, next]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightbox ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightbox]);

  // Touch swipe handlers for the lightbox (the in-page main image uses real
  // native scroll instead — see onMainImageScroll) — image slides only, so
  // they don't interfere with native video scrubbing controls.
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) { if (delta < 0) next(); else prev(); }
    touchStartX.current = null;
  };

  if (!media.length) return <div className={styles.placeholder} />;

  const hasMany = media.length > 1;
  // Defensive clamp — guards a stale index for one render if media shrinks
  // before the reset effect above runs.
  const active  = media[current] ?? media[0];

  return (
    <>
      {/* galleryWrap is position:relative so the absolutely-positioned navRow works on mobile */}
      <div className={styles.galleryWrap}>
        {/* gallery: strip is absolutely positioned so mainImage alone sets the height; strip scrolls vertically */}
        <div className={styles.gallery}>
          {/* Vertical thumbnail strip — desktop only */}
          {hasMany && (
            <div className={styles.thumbColumn}>
              <div
                ref={stripRef}
                className={`${styles.thumbStrip} ${canScrollUp ? styles.fadeTop : ""} ${canScrollDown ? styles.fadeBottom : ""}`}
              >
                {media.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className={`${styles.thumb} ${current === i ? styles.thumbActive : ""}`}
                    aria-label={`View ${item.type === "video" ? "video" : "image"} ${i + 1} of ${media.length}`}
                  >
                    <MediaThumb item={item} sizes="76px" />
                  </button>
                ))}
              </div>

              {/* Top edge cue — hover to auto-scroll up, click/Enter to nudge. */}
              <button
                type="button"
                className={`${styles.thumbEdge} ${styles.thumbEdgeTop} ${canScrollUp ? styles.thumbEdgeVisible : ""}`}
                aria-label="Show previous thumbnails"
                aria-hidden={!canScrollUp}
                tabIndex={canScrollUp ? 0 : -1}
                onMouseEnter={() => startAutoScroll(-1)}
                onMouseLeave={stopAutoScroll}
                onFocus={() => startAutoScroll(-1)}
                onBlur={stopAutoScroll}
                onClick={() => nudgeStrip(-1)}
              >
                <ChevronUp size={16} strokeWidth={2.5} />
              </button>

              {/* Bottom edge cue — hover to auto-scroll down and reveal the rest. */}
              <button
                type="button"
                className={`${styles.thumbEdge} ${styles.thumbEdgeBottom} ${canScrollDown ? styles.thumbEdgeVisible : ""}`}
                aria-label="Show more thumbnails"
                aria-hidden={!canScrollDown}
                tabIndex={canScrollDown ? 0 : -1}
                onMouseEnter={() => startAutoScroll(1)}
                onMouseLeave={stopAutoScroll}
                onFocus={() => startAutoScroll(1)}
                onBlur={stopAutoScroll}
                onClick={() => nudgeStrip(1)}
              >
                <ChevronDown size={16} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {/* Main media — crossfade stack on desktop; a real horizontal
              scroll-snap track on touch (≤900px, see .mainImage/.slideLayer
              in the CSS) — `current` stays the single source of truth either
              way, just synced from scroll position instead of touch-delta
              on mobile (see onMainImageScroll below). */}
          <div
            ref={mainImageRef}
            className={styles.mainImage}
            onClick={active.type === "image" ? () => setLightbox(true) : undefined}
            role={active.type === "image" ? "button" : undefined}
            tabIndex={active.type === "image" ? 0 : undefined}
            aria-label={active.type === "image" ? "Open full-size image" : undefined}
            onKeyDown={active.type === "image" ? (e => { if (e.key === "Enter" || e.key === " ") setLightbox(true); }) : undefined}
          >
            {media.map((item, i) => {
              const isActive = i === current;
              if (item.type === "video") {
                return (
                  <div key={item.url} className={`${styles.slideLayer} ${isActive ? styles.slideActive : ""}`}>
                    <GalleryVideo
                      src={item.url}
                      hlsSrc={item.hlsUrl}
                      poster={item.posterUrl}
                      active={isActive && !lightbox}
                      className={styles.mainVideo}
                    />
                    {/* Rendered per-slide (not once globally) so it scrolls correctly
                        with its own slide in the mobile scroll-snap track. */}
                    <button
                      type="button"
                      className={styles.mainExpandBtn}
                      onClick={() => setLightbox(true)}
                      aria-label="Open full-size viewer"
                    >
                      <Maximize2 size={15} />
                    </button>
                  </div>
                );
              }
              return (
                <div key={item.url} className={`${styles.slideLayer} ${isActive ? styles.slideActive : ""}`}>
                  <Image
                    src={item.url}
                    alt={`${title}${hasMany ? ` — image ${i + 1}` : ""}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 520px"
                    className={styles.mainImg}
                    priority={i === 0}
                  />
                </div>
              );
            })}

            {active.type === "image" && (
              <span className={styles.zoomHint} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
                </svg>
              </span>
            )}
          </div>
        </div>

        {/* Counter + arrows — below the image row */}
        {hasMany && (
          <div className={styles.navRow}>
            <button onClick={prev} className={styles.navBtn} aria-label="Previous media">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className={styles.counter}>{current + 1} / {media.length}</span>
            <button onClick={next} className={styles.navBtn} aria-label="Next media">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}

        {/* Dot indicators — mobile only (via CSS) */}
        {hasMany && (
          <div className={styles.dots} aria-hidden="true">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`${styles.dot} ${current === i ? styles.dotActive : ""}`}
                aria-label={`Go to media ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Edge prev/next — mobile only (via CSS). Complements swipe + dots
            with an explicit, always-reachable tap target; positioned against
            galleryWrap (not mainImage) so they float over the image at a
            fixed spot instead of scrolling away with the slide track. */}
        {hasMany && (
          <>
            <button
              type="button"
              onClick={prev}
              className={`${styles.mobileNavBtn} ${styles.mobileNavPrev}`}
              aria-label="Previous media"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={next}
              className={`${styles.mobileNavBtn} ${styles.mobileNavNext}`}
              aria-label="Next media"
            >
              <ChevronRight size={24} strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {/* Horizontal thumbnail row — mobile only (via CSS). Arrows page the strip
          on tap; there is deliberately no hover auto-scroll on touch. */}
      {hasMany && (
        <div className={styles.mobileStripWrap}>
          {mobileOverflow && (
            <button
              type="button"
              className={styles.mobileArrow}
              aria-label="Show previous thumbnails"
              disabled={!canScrollLeft}
              tabIndex={-1}
              onClick={() => pageMobileStrip(-1)}
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>
          )}

          <div ref={mobileStripRef} className={styles.mobileStrip} aria-hidden="true">
            {media.map((item, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`${styles.mobileThumbs} ${current === i ? styles.mobileThumbActive : ""}`}
                tabIndex={-1}
              >
                <MediaThumb item={item} sizes="64px" />
              </button>
            ))}
          </div>

          {mobileOverflow && (
            <button
              type="button"
              className={styles.mobileArrow}
              aria-label="Show more thumbnails"
              disabled={!canScrollRight}
              tabIndex={-1}
              onClick={() => pageMobileStrip(1)}
            >
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}

      {/* ── Mini floating viewer — appears when hero is scrolled past on mobile ─── */}
      {mounted && createPortal(
        <div
          className={`${styles.miniViewer} ${compact ? styles.miniViewerVisible : ""}`}
          aria-hidden={!compact}
        >
          {/* Media — tap to open lightbox */}
          <div
            className={styles.miniImage}
            onClick={() => compact && setLightbox(true)}
            role="button"
            tabIndex={compact ? 0 : -1}
            aria-label="Open media viewer"
            onKeyDown={e => { if (compact && (e.key === "Enter" || e.key === " ")) setLightbox(true); }}
          >
            <MediaThumb item={active} sizes="120px" />
          </div>

          {/* Navigation overlay — prev, counter, next */}
          {hasMany && (
            <div className={styles.miniOverlay}>
              <button
                onClick={e => { e.stopPropagation(); prev(); }}
                className={styles.miniBtn}
                tabIndex={compact ? 0 : -1}
                aria-label="Previous media"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <span className={styles.miniCounter}>{current + 1}/{media.length}</span>
              <button
                onClick={e => { e.stopPropagation(); next(); }}
                className={styles.miniBtn}
                tabIndex={compact ? 0 : -1}
                aria-label="Next media"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          )}

          {/* Expand / zoom hint */}
          <span className={styles.miniExpandHint} aria-hidden="true">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
            </svg>
          </span>
        </div>,
        document.body,
      )}

      {/* Lightbox — rendered via portal so it escapes the sticky galleryCol stacking context */}
      {lightbox && createPortal(
        <div
          className={styles.lightboxBackdrop}
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Product media viewer"
        >
          <div
            className={styles.lightboxInner}
            onClick={e => e.stopPropagation()}
            onTouchStart={active.type === "image" ? onTouchStart : undefined}
            onTouchEnd={active.type === "image" ? onTouchEnd : undefined}
          >
            {active.type === "video" ? (
              <GalleryVideo
                key={active.url}
                src={active.url}
                hlsSrc={active.hlsUrl}
                poster={active.posterUrl}
                active={lightbox}
                className={styles.lightboxVideo}
                allowFullscreen
              />
            ) : (
              <Image
                src={active.url}
                alt={`${title} — image ${current + 1}`}
                fill
                sizes="min(90vw, 90vh)"
                className={styles.lightboxImg}
                priority
              />
            )}

            <button
              onClick={() => setLightbox(false)}
              className={styles.lightboxClose}
              aria-label="Close viewer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            {hasMany && (
              <>
                <button onClick={prev} className={`${styles.lightboxNav} ${styles.lightboxPrev}`} aria-label="Previous media">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button onClick={next} className={`${styles.lightboxNav} ${styles.lightboxNext}`} aria-label="Next media">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
                <div className={styles.lightboxCounter} aria-live="polite">
                  {current + 1} / {media.length}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
});

export default ProductGallery;
