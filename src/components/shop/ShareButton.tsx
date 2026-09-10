"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Link2, Mail, Share2, X } from "lucide-react";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./ShareButton.module.css";

interface Props {
  title: string;
  /** Absolute or relative — resolved against the current origin on click. */
  url?: string;
  /** Used by Pinterest, which will not accept a pin without one. */
  imageUrl?: string | null;
}

type Channel = {
  key: string;
  label: string;
  href: (url: string, title: string, imageUrl?: string | null) => string;
  /** Brand colour, applied to the tile on hover only — a grid of six saturated
   *  squares fights the page for attention at rest. */
  color: string;
  icon: React.ReactNode;
};

const WhatsAppIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15s-.77.97-.94 1.17-.35.22-.65.07a8.13 8.13 0 0 1-2.39-1.47 8.98 8.98 0 0 1-1.66-2.06c-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37s-1.04 1.02-1.04 2.48 1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z" />
    <path d="M12.04 2A9.93 9.93 0 0 0 2.1 11.94c0 1.75.46 3.46 1.34 4.97L2 22.5l5.72-1.5a9.9 9.9 0 0 0 4.32.99h.01a9.93 9.93 0 0 0 9.93-9.94A9.93 9.93 0 0 0 12.04 2Zm5.8 15.73a8.24 8.24 0 0 1-5.8 2.4h-.01a8.24 8.24 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.05-.2-.31a8.23 8.23 0 0 1 12.8-10.14 8.18 8.18 0 0 1 2.42 5.83 8.24 8.24 0 0 1-2.42 5.78Z" />
  </svg>
);

const FacebookIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
  </svg>
);

const XIcon = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
    <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.02 4.13H5.05l12.03 15.64Z" />
  </svg>
);

const PinterestIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.64 7.86 6.36 9.32-.09-.79-.17-2.01.03-2.88.18-.78 1.17-4.97 1.17-4.97s-.3-.6-.3-1.48c0-1.39.81-2.43 1.81-2.43.85 0 1.26.64 1.26 1.41 0 .86-.55 2.14-.83 3.33-.24 1 .5 1.81 1.48 1.81 1.78 0 3.15-1.88 3.15-4.58 0-2.4-1.72-4.07-4.18-4.07-2.85 0-4.52 2.13-4.52 4.34 0 .86.33 1.78.74 2.28.08.1.09.19.07.29-.08.32-.25 1-.28 1.14-.04.19-.15.23-.34.14-1.27-.59-2.06-2.44-2.06-3.93 0-3.2 2.32-6.13 6.7-6.13 3.51 0 6.25 2.5 6.25 5.85 0 3.49-2.2 6.3-5.26 6.3-1.03 0-1.99-.53-2.32-1.17l-.63 2.4c-.23.88-.85 1.99-1.26 2.66.95.29 1.96.45 3.01.45 5.52 0 10-4.48 10-10S17.52 2 12 2Z" />
  </svg>
);

const CHANNELS: Channel[] = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    color: "#25D366",
    icon: WhatsAppIcon,
    href: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    key: "facebook",
    label: "Facebook",
    color: "#1877F2",
    icon: FacebookIcon,
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: "x",
    label: "X",
    color: "#000000",
    icon: XIcon,
    href: (url, title) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    key: "pinterest",
    label: "Pinterest",
    color: "#E60023",
    icon: PinterestIcon,
    href: (url, title, imageUrl) =>
      `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(title)}` +
      (imageUrl ? `&media=${encodeURIComponent(imageUrl)}` : ""),
  },
];

/**
 * Share control for the product page.
 *
 * Two paths on purpose. Where the browser has a share sheet — every phone, and
 * Safari — that sheet is used: it reaches the apps the customer actually has,
 * including the ones no hard-coded list can know about. Everywhere else (most
 * desktops) a popover offers the channels that matter for a shop plus a copy
 * link, which is what desktop sharing usually comes down to anyway.
 */
export default function ShareButton({ title, url, imageUrl }: Props) {
  const t = getTranslations(useLocale());
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const shareUrl = useCallback(() => {
    if (typeof window === "undefined") return url ?? "";
    return url ? new URL(url, window.location.origin).toString() : window.location.href;
  }, [url]);

  const handleTrigger = useCallback(async () => {
    // Read at click time rather than held in state: the server has no
    // navigator, so a state-driven branch would either render differently on
    // the client and mismatch on hydration, or need an effect that sets state
    // during mount. Neither buys anything — the answer is only needed here.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: `${t.shop.shareEmailSubject}: ${title}`, url: shareUrl() });
      } catch {
        // Dismissing the sheet rejects with AbortError. That is a choice, not
        // a failure, so it must not surface as one.
      }
      return;
    }
    setOpen((o) => !o);
  }, [title, shareUrl, t]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is permission-gated and blocked outright in some embedded
      // browsers; the link is selectable in the field either way.
    }
  }, [shareUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const href = shareUrl();

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={handleTrigger}
        aria-label={t.shop.share}
        title={t.shop.share}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <Share2 size={19} strokeWidth={1.9} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.panel} id={panelId} role="dialog" aria-label={t.shop.shareHeading}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>{t.shop.shareHeading}</span>
            <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label={t.support.close}>
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>

          <div className={styles.channels}>
            {CHANNELS.map((c) => (
              <a
                key={c.key}
                className={styles.channel}
                style={{ ["--channel-color" as string]: c.color }}
                href={c.href(href, title, imageUrl)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                <span className={styles.channelIcon}>{c.icon}</span>
                <span className={styles.channelLabel}>{c.label}</span>
              </a>
            ))}
            <a
              className={styles.channel}
              style={{ ["--channel-color" as string]: "var(--color-secondary)" }}
              href={`mailto:?subject=${encodeURIComponent(`${t.shop.shareEmailSubject}: ${title}`)}&body=${encodeURIComponent(href)}`}
              onClick={() => setOpen(false)}
            >
              <span className={styles.channelIcon}>
                <Mail size={18} strokeWidth={2} />
              </span>
              <span className={styles.channelLabel}>Email</span>
            </a>
          </div>

          {/* The link itself, visible: someone who does not trust a copy button
              can still read and select it. */}
          <div className={styles.linkRow}>
            <Link2 size={14} strokeWidth={2} className={styles.linkIcon} aria-hidden="true" />
            <input className={styles.linkInput} value={href} readOnly onFocus={(e) => e.currentTarget.select()} aria-label={t.shop.copyLink} />
            <button type="button" className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`} onClick={copy}>
              {copied ? (
                <>
                  <Check size={13} strokeWidth={2.6} aria-hidden="true" />
                  {t.shop.linkCopied}
                </>
              ) : (
                <>
                  <Copy size={13} strokeWidth={2.2} aria-hidden="true" />
                  {t.shop.copyLink}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
