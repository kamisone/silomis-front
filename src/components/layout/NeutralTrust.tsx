"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LockKeyhole, RotateCcw, MessageCircle, type LucideIcon } from "lucide-react";
import { openSupportChat } from "@/lib/support/openSupportChat";
import { getNeutralHeaderCopy } from "@/lib/i18n/neutralHeader";
import styles from "./NeutralTrust.module.css";

interface TrustItem {
  key: string;
  Icon: LucideIcon;
  title: string;
  sub: string;
  /** A page that backs the promise up, or — for help — the chat. */
  href?: string;
}

function trustItems(locale: string): TrustItem[] {
  const c = getNeutralHeaderCopy(locale);
  return [
    { key: "secure", Icon: LockKeyhole, title: c.secureTitle, sub: c.secureSub, href: `/${locale}/info/terms` },
    { key: "returns", Icon: RotateCcw, title: c.returnsTitle, sub: c.returnsSub, href: `/${locale}/info/returns` },
    { key: "help", Icon: MessageCircle, title: c.helpTitle, sub: c.helpSub },
  ];
}

/** One promise: a link to the page that backs it, or a button opening the chat. */
function TrustEntry({ item, className, children }: { item: TrustItem; className: string; children: React.ReactNode }) {
  return item.href ? (
    <Link href={item.href} className={className}>
      {children}
    </Link>
  ) : (
    <button type="button" className={className} onClick={openSupportChat}>
      {children}
    </button>
  );
}

/**
 * Desktop: the three promises in the middle of the neutral header, where the
 * space between logo and icons was empty — secure payment, 14-day returns, a
 * person to ask. Each one leads to what backs it up.
 */
export function NeutralTrustRow({ locale }: { locale: string }) {
  const items = trustItems(locale);
  return (
    <ul className={styles.row} aria-label={getNeutralHeaderCopy(locale).trustLabel}>
      {items.map((item) => (
        <li key={item.key} className={styles.rowCell}>
          <TrustEntry item={item} className={styles.rowItem}>
            <span className={`${styles.rowIcon} ${styles[`tone_${item.key}`]}`} aria-hidden="true">
              <item.Icon size={17} strokeWidth={2.2} />
            </span>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>{item.title}</span>
              <span className={styles.rowSub}>{item.sub}</span>
            </span>
          </TrustEntry>
        </li>
      ))}
    </ul>
  );
}

const TICK_MS = 3500;

/**
 * Phones: the same promises, one at a time in a slim line under the logo row,
 * sliding up every few seconds. Pauses while the visitor's finger or pointer
 * is on it and while the tab is hidden; with reduced motion it still changes,
 * without the slide.
 */
export function NeutralTrustTicker({ locale }: { locale: string }) {
  const items = trustItems(locale);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % items.length);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [paused, items.length]);

  return (
    <div
      className={styles.ticker}
      aria-label={getNeutralHeaderCopy(locale).trustLabel}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {items.map((item, i) => (
        <TrustEntry key={item.key} item={item} className={`${styles.tickerItem} ${i === index ? styles.tickerActive : ""} ${i === (index + items.length - 1) % items.length ? styles.tickerLeaving : ""}`}>
          <item.Icon size={14} strokeWidth={2.4} aria-hidden="true" className={styles.tickerIcon} />
          <strong>{item.title}</strong>
          <span className={styles.tickerSep} aria-hidden="true">
            ·
          </span>
          <span className={styles.tickerSub}>{item.sub}</span>
        </TrustEntry>
      ))}
    </div>
  );
}

/** "Help" next to the cart: opens the support chat — a person to ask is in sight before any doubt sets in. */
export function NeutralHelpButton({ locale }: { locale: string }) {
  const c = getNeutralHeaderCopy(locale);
  return (
    <button type="button" className={styles.help} onClick={openSupportChat} aria-label={`${c.helpButton} — ${c.helpSub}`}>
      <MessageCircle size={17} strokeWidth={2} aria-hidden="true" />
      <span className={styles.helpLabel}>{c.helpButton}</span>
    </button>
  );
}
