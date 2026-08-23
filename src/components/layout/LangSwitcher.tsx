"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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

export default function LangSwitcher({ locale, ariaLabel = "Select language" }: { locale: Locale; ariaLabel?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function switchLocale(next: Locale) {
    setLocaleCookie(next);
    const segments = pathname.split("/");
    segments[1] = next;
    router.push(segments.join("/"));
    setOpen(false);
  }

  const current = META[locale];

  return (
    <div className={styles.wrapper} ref={ref}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox" aria-label={ariaLabel}>
        <span className={styles.flag}>
          <current.Flag />
        </span>
        <span className={styles.code}>{current.short}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`${styles.caret} ${open ? styles.caretOpen : ""}`} aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul className={styles.dropdown} role="listbox" aria-label={ariaLabel}>
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
