"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import styles from "./Home.module.css";

export interface HeroSlide {
  id: string;
  /** Null renders the gradient treatment instead of a banner photo. */
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

const AUTOPLAY_MS = 5000;
/** Must match the .heroTrack transition duration in Home.module.css. */
const SLIDE_MS = 550;

/** Slide hrefs are stored locale-less ("/shop"); absolute URLs pass through. */
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
 * Autoplay pauses on hover, on keyboard focus, and while the tab is hidden — a
 * rotation that keeps moving under the pointer is the fastest way to make a
 * hero un-clickable.
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

  const activeIndex = !isCarousel ? 0 : pos === 0 ? count - 1 : pos === count + 1 ? 0 : pos - 1;

  const step = useCallback(
    (delta: number) => {
      if (!isCarousel || snapping) return;
      setPos((p) => p + delta);
    },
    [isCarousel, snapping],
  );

  const goTo = useCallback(
    (index: number) => {
      if (!isCarousel || snapping) return;
      setPos(index + 1);
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
      <div className={styles.heroViewport}>
        <div
          className={styles.heroTrack}
          style={{
            transform: `translate3d(-${pos * 100}%, 0, 0)`,
            transition: snapping ? "none" : undefined,
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
                  {slide.eyebrow && (
                    <span className={styles.heroEyebrow}>
                      <Sparkles size={13} strokeWidth={2.25} aria-hidden="true" />
                      {slide.eyebrow}
                    </span>
                  )}
                  {/* Only the visible slide's headline is the page h1 — several
                      h1s stacked in the DOM would confuse SEO and screen readers. */}
                  {active ? (
                    <h1 className={styles.heroTitle}>{slide.title}</h1>
                  ) : (
                    <p className={styles.heroTitle}>{slide.title}</p>
                  )}
                  {slide.subtitle && <p className={styles.heroSubtitle}>{slide.subtitle}</p>}
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

          <div className={styles.heroDots}>
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                className={`${styles.heroDot} ${i === activeIndex ? styles.heroDotActive : ""}`}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === activeIndex}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
