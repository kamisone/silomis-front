"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
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

interface FilterDrawerState {
  open: boolean;
  setOpen: (open: boolean) => void;
  isMobile: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

const FilterDrawerContext = createContext<FilterDrawerState | null>(null);

function useFilterDrawer(): FilterDrawerState {
  const ctx = useContext(FilterDrawerContext);
  if (!ctx) throw new Error("FilterDrawerTrigger/Panel must be rendered inside a FilterDrawerProvider");
  return ctx;
}

/**
 * The storefront's one mobile filter drawer's shared open/close state. Most
 * callers want the trigger and the panel sitting right next to each other —
 * use the default `FilterDrawer` export for that. A listing that needs the
 * trigger pinned somewhere else (under a banner, say) while the panel itself
 * stays put as the desktop sidebar column wires
 * `FilterDrawerProvider`/`FilterDrawerTrigger`/`FilterDrawerPanel` up
 * separately instead — same state, two DOM positions. `CategoryFilterSidebar`
 * (the /shop category grid) does exactly this.
 */
export function FilterDrawerProvider({ children }: { children: ReactNode }) {
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

  return <FilterDrawerContext.Provider value={{ open, setOpen, isMobile, triggerRef }}>{children}</FilterDrawerContext.Provider>;
}

/** The "Filters" button that opens the drawer — renderable anywhere inside a
 *  `FilterDrawerProvider`, independently of where `FilterDrawerPanel` ends up. */
export function FilterDrawerTrigger({ title, activeCount, className }: { title: string; activeCount: number; className?: string }) {
  const { open, setOpen, triggerRef } = useFilterDrawer();
  return (
    <button
      type="button"
      ref={triggerRef}
      className={`${styles.mobileTrigger} ${className ?? ""}`}
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
  );
}

/** The backdrop + slide-in panel itself. Below the `900px` breakpoint it's an
 *  off-canvas drawer (Escape/backdrop/close-button dismissal, scroll lock, a
 *  "Show results" footer); above it, a plain static column with none of this
 *  component's own styling — the caller's own desktop class (`className`)
 *  takes over entirely. */
export function FilterDrawerPanel({
  title,
  closeLabel,
  footerLabel,
  className,
  children,
}: {
  /** Drawer heading and (on mobile) the panel's aria-label. */
  title: string;
  /** aria-label for the close button. */
  closeLabel: string;
  /** Footer CTA text, e.g. "Show · 12 products" — composed by the caller so
   *  the plural/singular wording matches that listing's own vocabulary. */
  footerLabel: string;
  /** The caller's own desktop-only styling for the `<aside>` (sticky column,
   *  card padding, whatever that listing already had) — this component adds
   *  none of its own above the breakpoint. */
  className?: string;
  children: ReactNode;
}) {
  const { open, setOpen, isMobile, triggerRef } = useFilterDrawer();
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
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  return (
    <>
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

/**
 * The storefront's one mobile filter drawer, trigger and panel composed
 * together right next to each other — what /new and /sale (`CatalogListing`)
 * want. See `FilterDrawerProvider`/`FilterDrawerTrigger`/`FilterDrawerPanel`
 * above for the split version.
 */
export default function FilterDrawer({
  title,
  closeLabel,
  activeCount,
  footerLabel,
  className,
  children,
}: {
  title: string;
  closeLabel: string;
  activeCount: number;
  footerLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <FilterDrawerProvider>
      <FilterDrawerTrigger title={title} activeCount={activeCount} />
      <FilterDrawerPanel title={title} closeLabel={closeLabel} footerLabel={footerLabel} className={className}>
        {children}
      </FilterDrawerPanel>
    </FilterDrawerProvider>
  );
}
