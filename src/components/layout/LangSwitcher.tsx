"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/i18n";
import styles from "./LangSwitcher.module.css";

// ── Inline flag SVGs — kept self-contained rather than pulling in an icon library ──

function FlagGB() {
  return (
    <svg className={styles.flagSvg} viewBox="0 0 20 15" fill="none" aria-hidden="true">
      <rect width="20" height="15" fill="#012169" />
      <path d="M0 0L20 15M20 0L0 15" stroke="#fff" strokeWidth="4.5" />
      <path d="M0 0L20 15M20 0L0 15" stroke="#C8102E" strokeWidth="2.5" />
      <path d="M10 0V15M0 7.5H20" stroke="#fff" strokeWidth="6" />
      <path d="M10 0V15M0 7.5H20" stroke="#C8102E" strokeWidth="3.5" />
    </svg>
  );
}
function FlagFR() {
  return (
    <svg className={styles.flagSvg} viewBox="0 0 20 15" fill="none" aria-hidden="true">
      <rect width="20" height="15" fill="#ED2939" />
      <rect width="13" height="15" fill="#fff" />
      <rect width="7" height="15" fill="#002395" />
    </svg>
  );
}
function FlagES() {
  return (
    <svg className={styles.flagSvg} viewBox="0 0 20 15" fill="none" aria-hidden="true">
      <rect width="20" height="15" fill="#AA151B" />
      <rect y="3.75" width="20" height="7.5" fill="#F1BF00" />
    </svg>
  );
}
function FlagIT() {
  return (
    <svg className={styles.flagSvg} viewBox="0 0 20 15" fill="none" aria-hidden="true">
      <rect width="20" height="15" fill="#CE2B37" />
      <rect width="13.33" height="15" fill="#fff" />
      <rect width="6.67" height="15" fill="#008C45" />
    </svg>
  );
}
function FlagDE() {
  return (
    <svg className={styles.flagSvg} viewBox="0 0 20 15" fill="none" aria-hidden="true">
      <rect width="20" height="15" fill="#FFCE00" />
      <rect width="20" height="10" fill="#DD0000" />
      <rect width="20" height="5" fill="#000" />
    </svg>
  );
}
function FlagNL() {
  return (
    <svg className={styles.flagSvg} viewBox="0 0 20 15" fill="none" aria-hidden="true">
      <rect width="20" height="15" fill="#21468B" />
      <rect width="20" height="10" fill="#FFF" />
      <rect width="20" height="5" fill="#AE1C28" />
    </svg>
  );
}
function FlagPL() {
  return (
    <svg className={styles.flagSvg} viewBox="0 0 20 15" fill="none" aria-hidden="true">
      <rect width="20" height="15" fill="#DC143C" />
      <rect width="20" height="7.5" fill="#fff" />
    </svg>
  );
}

// Module-scope, not inline in the component: the mutation-detecting lint rule
// only analyzes assignments inside component/hook bodies.
function setLocaleCookie(next: Locale) {
  document.cookie = `silomis_locale=${next};path=/;max-age=31536000;SameSite=Lax`;
}

const META: Record<Locale, { label: string; short: string; Flag: () => React.ReactElement }> = {
  en: { label: "English", short: "EN", Flag: FlagGB },
  fr: { label: "Français", short: "FR", Flag: FlagFR },
  es: { label: "Español", short: "ES", Flag: FlagES },
  it: { label: "Italiano", short: "IT", Flag: FlagIT },
  de: { label: "Deutsch", short: "DE", Flag: FlagDE },
  nl: { label: "Nederlands", short: "NL", Flag: FlagNL },
  pl: { label: "Polski", short: "PL", Flag: FlagPL },
};

/** Roughly what the list measures: one option per locale plus the panel's own
 *  padding. Used to choose a side *before* the first paint — measuring the real
 *  node would mean rendering downwards and then jumping, which is the flicker
 *  this whole thing exists to avoid. The effect below corrects it from the real
 *  height afterwards, so the estimate only has to be close. */
const OPTION_HEIGHT = 33;
const PANEL_PADDING = 8;
const GAP = 6;
/** Keeps the panel off the very edge of the viewport when it flips. */
const VIEWPORT_MARGIN = 8;

export default function LangSwitcher({ locale, ariaLabel = "Select language" }: { locale: Locale; ariaLabel?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /** Opens upwards when there is not enough room below — which in the footer
   *  is always, and where opening downwards used to push the panel past the
   *  end of the document and grow the page by its own height. */
  const [up, setUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /** Which side the panel fits on, given a height. Prefers below, and only
   *  flips when above is genuinely roomier — a panel that flips for one spare
   *  pixel reads as a glitch. */
  const preferUp = useCallback((height: number) => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const below = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
    const above = rect.top - GAP - VIEWPORT_MARGIN;
    return height > below && above > below;
  }, []);

  // Re-decide while the panel is open: scrolling the trigger towards either
  // edge, or resizing, can change which side it fits on. Also corrects the
  // opening estimate from the list's real height.
  useEffect(() => {
    if (!open) return;
    const place = () => setUp(preferUp(listRef.current?.offsetHeight ?? 0));
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, preferUp]);

  function toggle() {
    setOpen((wasOpen) => {
      if (!wasOpen) setUp(preferUp(LOCALES.length * OPTION_HEIGHT + PANEL_PADDING));
      return !wasOpen;
    });
  }

  function close({ refocus = false } = {}) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  /** Arrow keys walk the list, Escape closes it and hands focus back — the
   *  behaviour a listbox is expected to have once it claims the role. */
  function onListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    const options = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const focus = (i: number) => {
      e.preventDefault();
      options[(i + options.length) % options.length]?.focus();
    };
    if (e.key === "ArrowDown") focus(index + 1);
    else if (e.key === "ArrowUp") focus(index - 1);
    else if (e.key === "Home") focus(0);
    else if (e.key === "End") focus(options.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      close({ refocus: true });
    }
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) toggle();
      // The list is not in the DOM until the state lands, so focus on the tick after.
      requestAnimationFrame(() => {
        const options = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
        if (!options?.length) return;
        (e.key === "ArrowDown" ? options[0] : options[options.length - 1]).focus();
      });
    } else if (e.key === "Escape" && open) {
      close();
    }
  }

  function switchLocale(next: Locale) {
    setLocaleCookie(next);
    const segments = pathname.split("/");
    segments[1] = next;
    // usePathname() never includes the query string, so a page reached with
    // one (`/shop?categoryId=…`, `/shop/search?q=…`) would otherwise switch
    // language into the bare path — and some of those redirect elsewhere
    // (`/shop` alone bounces to home) once the params that made them
    // meaningful are gone.
    const qs = searchParams.toString();
    router.push(segments.join("/") + (qs ? `?${qs}` : ""));
    setOpen(false);
  }

  const current = META[locale];

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
      >
        <span className={styles.flag}>
          <current.Flag />
        </span>
        <span className={styles.code}>{current.short}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`${styles.caret} ${open ? styles.caretOpen : ""}`} aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          className={`${styles.dropdown} ${up ? styles.dropdownUp : ""}`}
          role="listbox"
          aria-label={ariaLabel}
          onKeyDown={onListKeyDown}
        >
          {LOCALES.map((l) => {
            const meta = META[l];
            const active = l === locale;
            return (
              <li key={l}>
                <button type="button" role="option" aria-selected={active} className={`${styles.option} ${active ? styles.optionActive : ""}`} onClick={() => switchLocale(l)}>
                  <span className={styles.flag}>
                    <meta.Flag />
                  </span>
                  <span className={styles.optionLabel}>{meta.label}</span>
                  {active && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={styles.check} aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
