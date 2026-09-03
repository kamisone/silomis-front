"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import styles from "./FilterDrawer.module.css";

const MOBILE_QUERY = "(max-width: 900px)";

/** Whether the drawer breakpoint is active, kept in sync with the same
 *  `900px` cutoff the CSS itself switches on. `useSyncExternalStore` (rather
 *  than a `matchMedia` state + effect pair) is what keeps this lint-clean and
 *  hydration-safe: the server snapshot always says "desktop", matching what
 *  got rendered server-side, and the client corrects itself as soon as it
 *  can read the real viewport — no extra render-then-fix effect needed. */
function useIsMobileViewport(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(MOBILE_QUERY);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

/**
 * The storefront's one mobile filter drawer. A "Filters" trigger opens a
 * left-side off-canvas panel below the `900px` breakpoint — backdrop,
 * slide-in, Escape/backdrop/close-button dismissal, scroll lock, a "Show
 * results" footer to get back to the grid — and dissolves into a plain
 * static column above it (no trigger, no dialog semantics, the caller's own
 * desktop styling on `className` takes over). Two storefront listings share
 * this: the category grid (`CategoryFilterSidebar`) and the /new and /sale
 * listings (`CatalogListing`) — so the drawer only has to work once.
 *
 * This component owns only the open/close chrome; the filter content itself
 * — a price slider, checkbox groups, sort links, whatever a given listing
 * filters by — is entirely up to the caller via `children`.
 */
export default function FilterDrawer({
  title,
  closeLabel,
  activeCount,
  footerLabel,
  className,
  children,
}: {
  /** Drawer heading, trigger label, and (on mobile) the panel's aria-label. */
  title: string;
  /** aria-label for the close button. */
  closeLabel: string;
  /** Shown as a badge on the trigger when > 0. */
  activeCount: number;
  /** Footer CTA text, e.g. "Show · 12 products" — composed by the caller so
   *  the plural/singular wording matches that listing's own vocabulary. */
  footerLabel: string;
  /** The caller's own desktop-only styling for the `<aside>` (sticky column,
   *  card padding, whatever that listing already had) — this component adds
   *  none of its own above the breakpoint. */
  className?: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobileViewport();
  const [open, setOpen] = useState(false);
  // Widening past the drawer breakpoint while it happens to be open (a
  // resize, a rotation, closing devtools) shouldn't leave it stuck "open"
  // once it's back to being a static column with nothing to close. Reset
  // right here during render rather than in an effect — React's own
  // recommended way to adjust state in response to a changed value, and it
  // avoids the extra render-then-fix trip (and lint warning) a
  // `useEffect(() => setOpen(false), [isMobile])` would add.
  const [prevIsMobile, setPrevIsMobile] = useState(isMobile);
  if (isMobile !== prevIsMobile) {
    setPrevIsMobile(isMobile);
    if (!isMobile) setOpen(false);
  }

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  // Body scroll lock plus the two focus moves a modal drawer owes the
  // keyboard: send focus in on open (the close button), and give it back to
  // the trigger that opened it on close.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      closeBtnRef.current?.focus();
      wasOpenRef.current = true;
    } else {
      document.body.style.overflow = "";
      if (wasOpenRef.current) triggerRef.current?.focus();
      wasOpenRef.current = false;
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={styles.mobileTrigger}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={styles.triggerLabel}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          {title}
        </span>
        {activeCount > 0 && <span className={styles.triggerBadge}>{activeCount}</span>}
      </button>

      <div className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />

      <aside
        className={`${styles.panel} ${className ?? ""} ${open ? styles.panelOpen : ""}`}
        role={isMobile ? "dialog" : undefined}
        aria-modal={isMobile ? open : undefined}
        aria-label={isMobile ? title : undefined}
      >
        <div className={styles.drawerHead}>
          <span className={styles.drawerTitle}>{title}</span>
          <button type="button" ref={closeBtnRef} className={styles.closeBtn} onClick={() => setOpen(false)} aria-label={closeLabel}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.scrollArea}>{children}</div>

        <div className={styles.drawerFooter}>
          <button type="button" className={styles.showResultsBtn} onClick={() => setOpen(false)}>
            {footerLabel}
          </button>
        </div>
      </aside>
    </>
  );
}
