"use client";

import { createElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { TRUST_BADGE_ICON_OPTIONS, getTrustBadgeIcon } from "@/lib/shop/trustBadgeIcons";
import type { TrustBadgeIconName } from "@/lib/shop/productContent.types";
import styles from "./TrustBadgeIconSelect.module.css";

interface Props {
  value: TrustBadgeIconName;
  onChange: (icon: TrustBadgeIconName) => void;
}

const PANEL_MAX_HEIGHT = 280;

/**
 * Custom dropdown for picking a trust badge icon — each option renders its
 * actual icon, which a native <select> can't do. The panel is portaled to
 * <body> so it escapes `overflow: hidden` ancestors (CollapsibleSection),
 * and flips above the trigger when there's no room below.
 */
export default function TrustBadgeIconSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Anchor the fixed panel to the trigger; flip upward when it would clip. Must
  // run synchronously before paint (useLayoutEffect), so the setState calls here
  // are intentional and can't be deferred without reintroducing a positioning flicker.
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < PANEL_MAX_HEIGHT + 12 && rect.top > spaceBelow;
    setPos({
      top:   openUp ? Math.max(8, rect.top - 6 - PANEL_MAX_HEIGHT) : rect.bottom + 6,
      left:  rect.left,
      width: rect.width,
    });
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Close on outside click / Escape / scroll (fixed position goes stale)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Badge icon"
      >
        <span className={styles.iconChip}>{createElement(getTrustBadgeIcon(value), { size: 15 })}</span>
        <span className={styles.triggerLabel}>{value}</span>
        <ChevronDown size={14} className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          className={styles.panel}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          role="listbox"
          aria-label="Badge icon options"
        >
          {TRUST_BADGE_ICON_OPTIONS.map(({ name, Icon: OptionIcon }) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={name === value}
              className={`${styles.option} ${name === value ? styles.optionActive : ""}`}
              onClick={() => { onChange(name); setOpen(false); }}
            >
              <span className={styles.iconChip}><OptionIcon size={16} /></span>
              <span className={styles.optionLabel}>{name}</span>
              {name === value && <Check size={14} className={styles.optionCheck} />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
