"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, X, MessageCircle, Send } from "lucide-react";
import { useSupportChat, type SupportMessage } from "@/hooks/useSupportChat";
import { useCart } from "@/components/shop/CartContext";
import { getTranslations } from "@/lib/i18n";
import styles from "./SupportWidget.module.css";

interface Props { locale: string }

const MAX_LEN = 2000;

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

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 60);
    }
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

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
