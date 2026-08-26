"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import styles from "./Select.module.css";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** One line under the label — what this choice actually does. A native
   *  <option> has nowhere to put this, which is half the reason this exists. */
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

/** Where the menu can go, measured against the trigger. */
interface Rect {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "below" | "above";
}

const MENU_GAP = 6;
const MENU_MARGIN = 12;

/**
 * A listbox that looks the same on every OS and has room to explain itself.
 *
 * A native <select> is one line of text per choice, styled by the platform, and
 * on macOS it renders as an overlay panel that ignores the page's design
 * entirely. For settings where the choice needs a sentence of context — "Newest
 * first" versus "Hand-picked", which behave quite differently — that's the wrong
 * control, so this is a button plus a real listbox.
 *
 * The menu is portalled to <body> and positioned fixed: the cards it lives in
 * clip their overflow, and a popover that gets cut off by its own card is worse
 * than the native control it replaced.
 *
 * Keyboard contract matches the native one closely enough that muscle memory
 * carries over: Enter/Space/Arrow opens, arrows and Home/End move, typing jumps
 * to a matching option, Enter commits, Escape and Tab close.
 */
export default function Select<T extends string = string>({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Select…",
  ariaLabel,
  labelledBy,
  className,
  id,
}: {
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  labelledBy?: string;
  className?: string;
  id?: string;
}) {
  const generatedId = useId();
  const listId = `${id ?? generatedId}-listbox`;

  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  // Which option the keyboard is on. Distinct from `value`: moving through the
  // list must not commit anything until Enter.
  const [activeIndex, setActiveIndex] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ query: "", at: 0 });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - MENU_GAP - MENU_MARGIN;
    const above = r.top - MENU_GAP - MENU_MARGIN;
    // Flip up only when below genuinely cannot hold a usable menu — a list that
    // jumps sides on small scroll changes is more disorienting than a short one.
    const flip = below < 180 && above > below;
    setRect({
      top: flip ? r.top - MENU_GAP : r.bottom + MENU_GAP,
      left: r.left,
      width: r.width,
      maxHeight: Math.max(140, Math.min(320, flip ? above : below)),
      placement: flip ? "above" : "below",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
  }, [open, measure]);

  // Follow the trigger rather than close on scroll: these menus sit inside a
  // long scrolling list, and closing on every wheel tick would be unusable.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, measure]);

  // Pointer-down rather than click, so the menu is gone before the click lands
  // on whatever is underneath it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  // Keep the active option in view when the arrows walk past the fold.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openMenu(startAt = selectedIndex >= 0 ? selectedIndex : 0) {
    if (disabled) return;
    setActiveIndex(startAt);
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  }

  /** Next selectable index in `delta` direction, skipping disabled entries. */
  function step(from: number, delta: 1 | -1): number {
    const n = options.length;
    for (let i = 1; i <= n; i++) {
      const next = (from + delta * i + n * i) % n;
      if (!options[next]?.disabled) return next;
    }
    return from;
  }

  function firstEnabled(fromEnd = false): number {
    const list = fromEnd ? [...options].reverse() : options;
    const found = list.findIndex((o) => !o.disabled);
    if (found < 0) return 0;
    return fromEnd ? options.length - 1 - found : found;
  }

  /** Jump to the option starting with what was typed. Repeating one letter
   *  cycles through the options that start with it, as the native control does.
   *
   *  `now` comes from the event rather than a clock read: it is the same
   *  information, and it keeps this callable from render-phase code. */
  function onType(key: string, now: number) {
    const t = typeahead.current;
    t.query = now - t.at > 700 ? key : t.query + key;
    t.at = now;

    const q = t.query.toLowerCase();
    const repeated = q.length > 1 && q.split("").every((c) => c === q[0]);
    const needle = repeated ? q[0] : q;
    const from = repeated ? activeIndex + 1 : activeIndex;

    for (let i = 0; i < options.length; i++) {
      const index = (from + i) % options.length;
      const option = options[index];
      if (!option.disabled && option.label.toLowerCase().startsWith(needle)) {
        if (open) setActiveIndex(index);
        else commit(index);
        return;
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onType(e.key, e.timeStamp);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => step(i, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => step(i, -1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(firstEnabled());
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(firstEnabled(true));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        // Let focus leave, but don't leave a menu floating over the page.
        setOpen(false);
        break;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          onType(e.key, e.timeStamp);
        }
    }
  }

  const menu =
    open && rect
      ? createPortal(
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-activedescendant={`${listId}-${activeIndex}`}
            tabIndex={-1}
            className={`${styles.menu} ${rect.placement === "above" ? styles.menuAbove : ""}`}
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              maxHeight: rect.maxHeight,
            }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  className={[
                    styles.option,
                    index === activeIndex ? styles.optionActive : "",
                    isSelected ? styles.optionSelected : "",
                    option.disabled ? styles.optionDisabled : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  // Mouse moves set the active row so the keyboard highlight and
                  // the pointer never disagree about where "here" is.
                  onPointerMove={() => !option.disabled && setActiveIndex(index)}
                  onClick={() => commit(index)}
                >
                  <span className={styles.optionCheck} aria-hidden="true">
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className={styles.optionBody}>
                    <span className={styles.optionLabel}>
                      {option.icon && <span className={styles.optionIcon}>{option.icon}</span>}
                      {option.label}
                    </span>
                    {option.description && <span className={styles.optionDesc}>{option.description}</span>}
                  </span>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        disabled={disabled}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""} ${className ?? ""}`}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={`${styles.triggerText} ${selected ? "" : styles.triggerPlaceholder}`}>
          {selected?.icon && <span className={styles.optionIcon}>{selected.icon}</span>}
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={15} strokeWidth={2.25} className={styles.chevron} aria-hidden="true" />
      </button>
      {menu}
    </>
  );
}
