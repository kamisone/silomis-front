"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import styles from "./Home.module.css";

export interface HeroSlide {
  id: string;
  /** Null renders the gradient treatment instead of a banner photo. */
  imageUrl: string | null;
  imageAlt: string | null;
  eyebrow: string | null;
  /** The card's copy as one HTML block, written in the admin's WYSIWYG. */
  content: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryHref: string | null;
}

const AUTOPLAY_MS = 5000;
/** Must match the .heroTrack transition duration in Home.module.css. */
const SLIDE_MS = 550;

/** A drag has to clear this before it counts as a swipe rather than a tap, and
 *  before the track starts following the finger at all. */
const DRAG_START_PX = 6;
/** Past this fraction of the slide's width, letting go advances. */
const DRAG_COMMIT_RATIO = 0.18;
const DRAG_COMMIT_MIN_PX = 44;
/** …or a flick shorter than that, if it was fast enough (px per millisecond). */
const FLICK_VELOCITY = 0.4;

/**
 * Exactly one `<h1>` in the document, whatever the admin wrote.
 *
 * The editor offers H1–H6, but only one element on a page may be *the* page
 * heading and the editor cannot know which slide is visible. So the rule lives
 * here instead: the visible slide gets an H1 — its own if the author set one,
 * otherwise its first H2 raised — and every other slide has its H1s demoted.
 * Attributes ride along, so an aligned or re-led heading keeps its styling.
 */
function withPageHeading(html: string): string {
  if (/<h1[\s>]/i.test(html)) return html;
  return html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/i, (_m, attrs: string | undefined, inner: string) => `<h1${attrs ?? ""}>${inner}</h1>`);
}

function demoteHeadings(html: string): string {
  return html.replace(/<(\/?)h1(\s|>)/gi, "<$1h2$2");
}

/** Slide hrefs are stored locale-less ("/collections"); absolute URLs pass through. */
function resolveHref(href: string, locale: string): string {
  return /^https?:\/\//.test(href) ? href : `/${locale}${href.startsWith("/") ? href : `/${href}`}`;
}

/**
 * The home page hero: a sliding carousel of admin-authored slides.
 *
 * A slide with an image is a banner; a slide without one keeps the original
 * gradient treatment, so an editorial "text and buttons" slide and a photo
 * campaign live in the same rotation.
 *
 * Autoplay pauses on hover, on keyboard focus, while a finger is on the track,
 * and while the tab is hidden — a rotation that keeps moving under the pointer
 * is the fastest way to make a hero un-clickable.
 *
 * Controls differ by pointer: a mouse gets the arrows, a finger gets the swipe.
 * Below 720px the arrows are gone, so dragging is the whole navigation — see
 * the Swipe block below.
 */
export default function HomeHero({ slides, locale }: { slides: HeroSlide[]; locale: string }) {
  const count = slides.length;
  const isCarousel = count > 1;

  // The track carries a clone of the last slide before the first and a clone of
  // the first after the last, so wrapping around slides *onward* in the
  // direction you were already going instead of sweeping back across every
  // slide. `pos` indexes that padded track; slide 0 sits at pos 1.
  const track = isCarousel ? [slides[count - 1], ...slides, slides[0]] : slides;
  const [pos, setPos] = useState(isCarousel ? 1 : 0);
  // True for the single frame where the track jumps from a clone to its real
  // twin — the same picture, so the cut is invisible, but the transition has to
  // be off or the jump would animate backwards across the whole strip.
  const [snapping, setSnapping] = useState(false);
  const [paused, setPaused] = useState(false);

  const step = useCallback(
    (delta: number) => {
      if (!isCarousel || snapping) return;
      setPos((p) => p + delta);
    },
    [isCarousel, snapping],
  );

  useEffect(() => {
    if (!isCarousel || paused) return;
    const timer = setInterval(() => setPos((p) => p + 1), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [isCarousel, paused]);

  // Landed on a clone → let the slide finish, then jump to its real twin.
  // Driven by a timer rather than `transitionend` so it still resolves when the
  // transition is suppressed (reduced motion, background tab).
  useEffect(() => {
    if (!isCarousel) return;
    if (pos !== 0 && pos !== count + 1) return;
    const timer = setTimeout(() => {
      setSnapping(true);
      setPos(pos === 0 ? count : 1);
    }, SLIDE_MS);
    return () => clearTimeout(timer);
  }, [pos, count, isCarousel]);

  // Re-arm the transition only once the un-animated jump has actually painted;
  // a single frame isn't always enough, hence the nested rAF.
  useEffect(() => {
    if (!snapping) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSnapping(false));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [snapping]);

  // ── Swipe ────────────────────────────────────────────────────────────────
  // Below the arrows' breakpoint there is no other control at all, so dragging
  // has to track the finger rather than just detect a fling. `drag` is live pixels added to the track's
  // transform; letting go clears it and moves `pos` in the same batch, so the
  // slide settles into place on the stylesheet's own easing.
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointer = useRef<{ id: number; x: number; t: number; width: number; moved: boolean } | null>(null);
  // A drag that ends over the CTA would otherwise fire its click on release.
  const swallowClick = useRef(false);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    swallowClick.current = false;
    // A mouse keeps the arrows; hijacking its drag only fights text selection
    // and link clicks on a pointer that already has a better control.
    if (!isCarousel || snapping || e.pointerType === "mouse") return;
    pointer.current = { id: e.pointerId, x: e.clientX, t: Date.now(), width: e.currentTarget.clientWidth || 1, moved: false };
    setPaused(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || e.pointerId !== p.id) return;
    const dx = e.clientX - p.x;
    if (!p.moved) {
      if (Math.abs(dx) < DRAG_START_PX) return;
      p.moved = true;
      setDragging(true);
    }
    setDrag(dx);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const p = pointer.current;
    if (!p || e.pointerId !== p.id) return;
    pointer.current = null;
    setPaused(false);
    setDragging(false);
    setDrag(0);
    if (!p.moved) return;
    swallowClick.current = true;
    // The browser took the gesture over for a vertical scroll — snap back, quietly.
    if (cancelled) return;

    const dx = e.clientX - p.x;
    const velocity = dx / Math.max(1, Date.now() - p.t);
    const far = Math.abs(dx) > Math.max(DRAG_COMMIT_MIN_PX, p.width * DRAG_COMMIT_RATIO);
    if (far || Math.abs(velocity) > FLICK_VELOCITY) step(dx < 0 ? 1 : -1);
  }

  // Nothing is gained by rotating in a background tab, and it means the visitor
  // doesn't come back to a slide four steps past where they left off.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (count === 0) return null;

  return (
    <section
      className={styles.hero}
      aria-roledescription={isCarousel ? "carousel" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className={styles.heroViewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onClickCapture={(e) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div
          className={styles.heroTrack}
          style={{
            transform: `translate3d(calc(${-pos * 100}% + ${drag}px), 0, 0)`,
            // Following a finger has to be immediate; easing it would feel like
            // lag. The transition comes back on release, which is what turns
            // letting go into a settle rather than a jump.
            transition: snapping || dragging ? "none" : undefined,
          }}
        >
          {track.map((slide, i) => {
            const active = i === pos;
            return (
              <div
                key={`${slide.id}-${i}`}
                className={`${styles.heroSlide} ${slide.imageUrl ? styles.heroSlideImage : styles.heroSlideGradient}`}
                // Everything off-screen — including the clones — stays out of the
                // a11y tree and the tab order.
                aria-hidden={!active}
                inert={!active}
              >
                {slide.imageUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.imageUrl}
                      alt={slide.imageAlt ?? ""}
                      className={styles.heroImage}
                      loading={i <= 1 ? "eager" : "lazy"}
                      fetchPriority={i === 1 ? "high" : "auto"}
                    />
                    <span className={styles.heroScrim} aria-hidden="true" />
                  </>
                )}

                <div className={`${styles.container} ${styles.heroInner}`}>
                  {/* The copy is a panel over the picture, not a caption across
                      it: it carries its own background, so legibility no longer
                      depends on how busy the photo behind it happens to be. */}
                  <div className={styles.heroCard}>
                    {slide.eyebrow && (
                      <span className={styles.heroEyebrow}>
                        <Sparkles size={13} strokeWidth={2.25} aria-hidden="true" />
                        {slide.eyebrow}
                      </span>
                    )}
                    {/* One HTML block from the admin's editor. Written behind admin
                        auth, like the collection and page-content bodies rendered the
                        same way elsewhere. Only the visible slide gets the page h1 —
                        several stacked in the DOM would confuse SEO and screen readers. */}
                    {slide.content && (
                      <div
                        className={styles.heroCopy}
                        dangerouslySetInnerHTML={{ __html: active ? withPageHeading(slide.content) : demoteHeadings(slide.content) }}
                      />
                    )}
                    {(slide.ctaLabel || slide.ctaSecondaryLabel) && (
                      <div className={styles.heroActions}>
                        {slide.ctaLabel && slide.ctaHref && (
                          <Link href={resolveHref(slide.ctaHref, locale)} className={styles.heroCta}>
                            {slide.ctaLabel}
                            <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" />
                          </Link>
                        )}
                        {slide.ctaSecondaryLabel && slide.ctaSecondaryHref && (
                          <Link href={resolveHref(slide.ctaSecondaryHref, locale)} className={styles.heroCtaSecondary}>
                            {slide.ctaSecondaryLabel}
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isCarousel && (
        <>
          <button
            type="button"
            className={`${styles.heroArrow} ${styles.heroArrowPrev}`}
            onClick={() => step(-1)}
            aria-label="Previous slide"
          >
            <ChevronLeft size={22} strokeWidth={2.25} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.heroArrow} ${styles.heroArrowNext}`}
            onClick={() => step(1)}
            aria-label="Next slide"
          >
            <ChevronRight size={22} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </>
      )}
    </section>
  );
}
