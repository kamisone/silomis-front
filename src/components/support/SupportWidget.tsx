"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headphones, X, MessageCircle, Send, Check } from "lucide-react";
import { useSupportChat, type SupportMessage } from "@/hooks/useSupportChat";
import { useCart } from "@/components/shop/CartContext";
import { getTranslations } from "@/lib/i18n";
import styles from "./SupportWidget.module.css";

interface Props { locale: string }

const MAX_LEN = 2000;

/** Beyond half an hour the "looking for someone" card stops being true. */
const MAX_WAIT_DISPLAY_SECONDS = 30 * 60;

// Cache formatters — creating Intl objects is expensive
const rtfCache = new Map<string, Intl.RelativeTimeFormat>();
function rtf(locale: string) {
  if (!rtfCache.has(locale))
    rtfCache.set(locale, new Intl.RelativeTimeFormat(locale, { numeric: "auto" }));
  return rtfCache.get(locale)!;
}

function relTime(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const fmt  = rtf(locale);
  if (diff < 60_000)     return fmt.format(-Math.floor(diff / 1_000),    "second");
  if (diff < 3_600_000)  return fmt.format(-Math.floor(diff / 60_000),   "minute");
  if (diff < 86_400_000) return fmt.format(-Math.floor(diff / 3_600_000),"hour");
  return fmt.format(-Math.floor(diff / 86_400_000), "day");
}

function lastSeenGuestMsgId(msgs: SupportMessage[]): string | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].senderType === "guest" && msgs[i].readAt) return msgs[i].id;
  }
  return null;
}

/**
 * How long the guest has been waiting on a reply, or null when they are not.
 *
 * Anchored to the OLDEST message in the unanswered trailing run, not the
 * newest: someone who sends three messages in a row has been waiting since the
 * first one, and restarting the clock on each would keep the status stuck on
 * "connecting" forever. A failed send is not a wait — the retry button is the
 * right thing to look at there, so the waiting card stands down.
 */
function pendingSince(msgs: SupportMessage[]): string | null {
  let oldest: string | null = null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i];
    if (msg.senderType !== "guest") break;
    if (msg._status === "failed") return null;
    oldest = msg.createdAt;
  }
  return oldest;
}

/** Seconds waited -> which reassurance to show. */
function waitStage(seconds: number): "connecting" | "searching" | "shortly" | "long" {
  if (seconds < 5) return "connecting";
  if (seconds < 25) return "searching";
  if (seconds < 90) return "shortly";
  return "long";
}

function StatusIcon({ status, t }: { status: SupportMessage["_status"]; t: ReturnType<typeof getTranslations>["support"] }) {
  if (!status || status === "sent") return null;
  if (status === "sending") return <span className={styles.statusSending} title={t.statusSending}>◷</span>;
  return <span className={styles.statusFailed} title={t.statusFailed}>!</span>;
}

export default function SupportWidget({ locale }: Props) {
  const t = getTranslations(locale).support;

  const [open,      setOpen]      = useState(false);
  const [input,     setInput]     = useState("");
  const [guestName, setGuestName] = useState("");
  const [nameSet,   setNameSet]   = useState(false);

  const { cart } = useCart();

  // On the checkout page, "/shop/checkout" alone tells an admin nothing about
  // what the customer is buying — so surface the cart's product page URLs
  // instead. Read lazily at send time, not memoized on cart/pathname, since
  // the guest can navigate to checkout after the widget/hook already mounted.
  const getCheckoutProducts = useCallback(() => {
    if (typeof window === "undefined") return undefined;
    if (!window.location.pathname.includes("/shop/checkout")) return undefined;
    if (!cart?.items?.length) return undefined;
    const seen = new Set<string>();
    const products: Array<{ title: string; url: string }> = [];
    for (const item of cart.items) {
      if (!item.productSlug || seen.has(item.productSlug)) continue;
      seen.add(item.productSlug);
      products.push({
        title: item.titleSnapshot,
        url: `${window.location.origin}/${locale}/shop/${item.productSlug}`,
      });
    }
    return products.length ? products : undefined;
  }, [cart, locale]);

  const { messages, status, unreadCount, adminTyping, sendMessage, retryMessage, retry, emitTyping } = useSupportChat(open, getCheckoutProducts);

  const bottomRef        = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLTextAreaElement>(null);
  const originalTitleRef = useRef<string>("");
  const prevUnreadRef    = useRef(0);
  const typingTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Capture the page title once on mount so we can restore it later
  useEffect(() => { originalTitleRef.current = document.title; }, []);

  // popKey increments each time a new unread message arrives while the widget
  // is closed. A new key remounts the ripple span, re-triggering its animation.
  const [popKey, setPopKey] = useState(0);
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current && !open) setPopKey(k => k + 1);
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, open]);

  // Alternate tab title between original and notification while unread messages exist
  useEffect(() => {
    if (!originalTitleRef.current) return;

    if (unreadCount > 0 && !open) {
      const notifTitle = unreadCount === 1
        ? t.tabUnreadOne
        : `(${unreadCount}) ${t.tabUnreadMany}`;

      document.title = notifTitle;
      let showingOriginal = false;
      const id = setInterval(() => {
        showingOriginal = !showingOriginal;
        document.title = showingOriginal ? originalTitleRef.current : notifTitle;
      }, 2_000);

      return () => {
        clearInterval(id);
        document.title = originalTitleRef.current;
      };
    }

    document.title = originalTitleRef.current;
  }, [unreadCount, open, t]);

  // Always restore on unmount
  useEffect(() => () => { if (originalTitleRef.current) document.title = originalTitleRef.current; }, []);

  const seenId = lastSeenGuestMsgId(messages);

  // ── "Someone will be with you" waiting state ──────────────────────────────
  // The admin actually typing is a better signal than any of this, so the
  // typing indicator wins and this stands down while it is showing.
  const waitingSince = useMemo(() => pendingSince(messages), [messages]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!open || !waitingSince) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, waitingSince]);

  // max(0, …) covers a server timestamp a moment ahead of the client: the ACK
  // swaps the optimistic message for the stored row, and a skewed clock would
  // otherwise make the wait negative.
  const waitedSeconds = waitingSince ? Math.max(0, Math.floor((nowMs - new Date(waitingSince).getTime()) / 1000)) : 0;

  // Past the ceiling nobody is plausibly still "searching" — an animated hunt
  // over a message left unanswered since yesterday would be a lie. The card
  // simply stands down and the conversation reads as ordinary history.
  const showWaiting =
    open && !!waitingSince && !adminTyping && status === "connected" && waitedSeconds < MAX_WAIT_DISPLAY_SECONDS;

  const stage = waitStage(waitedSeconds);
  const waitingText = {
    connecting: t.waitingConnecting,
    searching: t.waitingSearching,
    shortly: t.waitingShortly,
    long: t.waitingLong,
  }[stage];

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 60);
    }
  }, [open]);

  // `stage`/`showWaiting` are dependencies too: the waiting card grows when it
  // reaches the long-wait hint, which would otherwise push the newest message
  // out of view.
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, showWaiting, stage]);

  const handleTypingChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value.slice(0, MAX_LEN));
    if (status !== "connected") return;
    emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 2000);
  };

  const handleSend = () => {
    const content = input.trim();
    if (!content || status !== "connected") return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    emitTyping(false);
    const name = !nameSet && guestName.trim() ? guestName.trim() : undefined;
    if (name) setNameSet(true);
    sendMessage(content, name);
    setInput("");
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const dotClass = status === "connected" ? styles.dotGreen
    : status === "connecting"             ? styles.dotAmber
    : styles.dotRed;

  return (
    <div className={styles.root}>
      {open && (
        <div className={styles.window} role="dialog" aria-label={t.title}>

          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <Headphones size={18} strokeWidth={1.75} className={styles.headerIcon} />
              <div>
                <p className={styles.headerTitle}>{t.title}</p>
                <p className={styles.headerSub}>{t.subtitle}</p>
              </div>
            </div>
            <div className={styles.headerRight}>
              <span className={`${styles.statusDot} ${dotClass}`} title={status} />
              <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label={t.close}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.emptyState}>
                <MessageCircle size={32} strokeWidth={1.5} className={styles.emptyIcon} />
                <p>{t.emptyState}</p>
              </div>
            )}

            {messages.map(msg => {
              const isGuest   = msg.senderType === "guest";
              const isFailed  = msg._status === "failed";
              const isSeenMsg = msg.id === seenId;

              return (
                <div key={msg.id} className={`${styles.messageGroup} ${isGuest ? styles.messageGroupGuest : ""}`}>
                  <div className={`${styles.bubble} ${isGuest ? styles.bubbleGuest : msg.senderType === "system" ? styles.bubbleSystem : styles.bubbleAdmin} ${isFailed ? styles.bubbleFailed : ""}`}>
                    {!isGuest && msg.senderType !== "system" && (
                      <span className={styles.senderLabel}>{t.agentLabel}</span>
                    )}
                    <p className={styles.bubbleText}>
                      {/* System messages are machine keys — translate them */}
                      {msg.senderType === "system" ? (t as Record<string, string>)[`system_${msg.content}`] ?? msg.content : msg.content}
                    </p>
                    <div className={styles.bubbleMeta}>
                      <span className={styles.bubbleTime}>{relTime(msg.createdAt, locale)}</span>
                      {isGuest && <StatusIcon status={msg._status} t={t} />}
                    </div>
                  </div>

                  {isFailed && msg._clientId && (
                    <button className={styles.retryInline} onClick={() => retryMessage(msg._clientId!)}>
                      {t.retry}
                    </button>
                  )}

                  {isSeenMsg && <span className={styles.seenLabel}>{t.seenLabel}</span>}
                </div>
              );
            })}

            {status === "error" && (
              <div className={styles.errorBanner}>
                {t.connectionError}
                <button className={styles.retryBtn} onClick={retry}>{t.retry}</button>
              </div>
            )}
            {(status === "connecting" || status === "idle") && (
              <p className={styles.connectingMsg}>{t.connecting}</p>
            )}
            {adminTyping && (
              <div className={styles.typingIndicator}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingLabel}>{t.agentTyping}</span>
              </div>
            )}

            {showWaiting && (
              <div className={styles.waiting} role="status" aria-live="polite">
                <span className={styles.waitingAvatar} aria-hidden="true">
                  {/* Two rings expand outwards on a loop — the "scanning for
                      someone" motion, rather than a spinner that only says
                      "busy". */}
                  <span className={styles.waitingRing} />
                  <span className={`${styles.waitingRing} ${styles.waitingRingDelayed}`} />
                  <Headphones size={15} strokeWidth={1.9} />
                </span>

                <div className={styles.waitingBody}>
                  <span className={styles.waitingReceived}>
                    <Check size={12} strokeWidth={2.5} /> {t.waitingReceived}
                  </span>

                  {/* Keyed so the fade-in replays whenever the wording moves on. */}
                  <span key={stage} className={styles.waitingText}>
                    {waitingText}
                    <span className={styles.waitingDots} aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </span>

                  <span className={styles.waitingTrack} aria-hidden="true">
                    <span className={styles.waitingBar} />
                  </span>

                  {stage === "long" && <span className={styles.waitingHint}>{t.waitingHint}</span>}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Name prompt */}
          {!nameSet && messages.filter(m => m.senderType === "guest").length === 0 && (
            <div className={styles.namePrompt}>
              <input
                className={styles.nameInput}
                placeholder={t.namePlaceholder}
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                maxLength={80}
              />
            </div>
          )}

          {/* Input */}
          <div className={styles.inputRow}>
            <textarea
              ref={inputRef}
              className={styles.input}
              placeholder={status === "connected" ? t.inputPlaceholder : t.notConnected}
              value={input}
              onChange={handleTypingChange}
              onKeyDown={handleKey}
              rows={2}
              disabled={status !== "connected"}
            />
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!input.trim() || status !== "connected"}
              aria-label={t.send}
            >
              <Send size={16} strokeWidth={1.75} />
            </button>
          </div>
          <p className={styles.charCount}>{input.length}/{MAX_LEN}</p>
        </div>
      )}

      <div className={styles.bubbleArea}>
        {/* Ripple — remounted on each new message, re-triggers animation */}
        {popKey > 0 && !open && (
          <span key={popKey} className={styles.ripple} aria-hidden="true" />
        )}

        <button
          className={[
            styles.bubble_btn,
            open                          ? styles.bubble_btn_open   : "",
            unreadCount > 0 && !open      ? styles.bubble_btn_unread : "",
          ].join(" ")}
          onClick={() => setOpen(o => !o)}
          aria-label={open ? t.close : t.openChat}
          aria-expanded={open}
        >
          {open
            ? <X size={20} strokeWidth={1.75} aria-hidden="true" />
            : <MessageCircle size={20} strokeWidth={1.75} aria-hidden="true" />
          }
          {!open && unreadCount > 0 && (
            <span key={unreadCount} className={styles.unreadBadge} aria-label={`${unreadCount} unread`}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
