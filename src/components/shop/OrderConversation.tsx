"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, MessageSquare, RotateCcw, Send, X } from "lucide-react";
import { orderTransport, useSupportChat, type MessageAttachment } from "@/hooks/useSupportChat";
import ImageLightbox from "./ImageLightbox";
import { getTranslations, toBcp47, type Locale } from "@/lib/i18n";
import styles from "./OrderConversation.module.css";

/** Must match ATTACHMENT_MAX_FILES on the server, which refuses more. */
const MAX_IMAGES = 4;

/** A picked file and the blob URL its preview renders from. */
interface PendingImage {
  file: File;
  url: string;
}

/**
 * The customer's half of an order conversation, on the order's own tracking
 * page.
 *
 * Deliberately not the floating support widget. Two chat bubbles on one screen
 * is a puzzle, and the two conversations are different things: the widget is a
 * stranger asking a pre-sales question, this is a named customer writing about
 * a paid order. It reuses the widget's transport wholesale, though — the same
 * socket, the same optimistic send and reconciliation, the same reconnect.
 *
 * Open to anyone who opened the tracking page — the emailed link and the
 * order-number-plus-address lookup both reach it, with no extra step. The
 * grant cookie the page already holds is what authenticates every call; see
 * SupportOrderController for what that does and does not prove.
 */
export default function OrderConversation({
  orderNumber,
  locale,
  /** False while the Messages tab is not the one on screen. */
  active,
}: {
  orderNumber: string;
  locale: Locale;
  active: boolean;
}) {
  const t = getTranslations(locale).orderChat;

  // A stable object across renders: the hook keeps it in a ref that the
  // socket's auth callback reads on every reconnect.
  const transport = useMemo(() => orderTransport(orderNumber), [orderNumber]);

  // Drives connect/disconnect, so the socket only exists while the tab is
  // open — a customer reading their delivery timeline holds no connection.
  const { messages, status, sendMessage, retryMessage, markRead } = useSupportChat(active, undefined, transport);

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [viewing, setViewing] = useState<{ images: MessageAttachment[]; index: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  // Stick to the newest message, the way every chat does.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (active && messages.length) markRead();
  }, [active, messages, markRead]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content && pending.length === 0) return;

    // Images go over HTTP, text over the socket. The upload endpoint creates
    // the message itself and broadcasts it, so the picture arrives on the
    // other side the same way a line of text does — the client never handles
    // a storage key.
    if (pending.length > 0) {
      setUploading(true);
      setUploadError("");
      try {
        const body = new FormData();
        if (content) body.append("content", content);
        for (const p of pending) body.append("images", p.file);
        const res = await fetch(
          `/next-api/public/shop/orders/${encodeURIComponent(orderNumber)}/conversation/attachments`,
          { method: "POST", body },
        );
        if (!res.ok) throw new Error("upload failed");
        clearPending();
        setDraft("");
        if (draftRef.current) autoGrow(draftRef.current);
      } catch {
        setUploadError(t.attachFailed);
      } finally {
        setUploading(false);
      }
      return;
    }

    sendMessage(content);
    setDraft("");
    if (draftRef.current) draftRef.current.style.height = "auto";
  }

  /**
   * Grows the box with the text, to a few lines, then scrolls.
   *
   * Done in script rather than with `field-sizing: content`, which does
   * exactly this natively but is not in Firefox or Safari yet — and a
   * composer that silently stays one line high in two of three browsers is
   * the bug this is meant to fix.
   */
  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function onDraftKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift + Enter breaks the line — the convention every chat
    // shares, and the reason the box can be a textarea without costing the
    // one-key send. A composing IME must be left alone: while a Japanese or
    // Korean candidate list is open, Enter is choosing a character.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit(e);
    }
  }

  /**
   * Takes the files the picker returned.
   *
   * `chosen` is copied out **before** the input is cleared, and the previews
   * are built here rather than in render. Both matter:
   *
   *  - Clearing `input.value` empties `input.files`, and a `FileList` is live.
   *    The first version passed the list itself into a state updater, which
   *    React runs after this function returns — by then the list the updater
   *    read was empty, so choosing a photo did nothing at all.
   *  - `URL.createObjectURL` in render mints a new blob on every pass and
   *    leaks every previous one. One per file, revoked when it goes.
   */
  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const chosen = Array.from(list);
    // Cleared so choosing the same file twice in a row still fires onChange.
    if (fileRef.current) fileRef.current.value = "";

    const merged = [...pending, ...chosen.map((file) => ({ file, url: URL.createObjectURL(file) }))];
    const kept = merged.slice(0, MAX_IMAGES);
    for (const dropped of merged.slice(MAX_IMAGES)) URL.revokeObjectURL(dropped.url);

    setUploadError(merged.length > MAX_IMAGES ? t.attachTooMany : "");
    setPending(kept);
  }

  function removePending(index: number) {
    setPending((prev) => {
      const gone = prev[index];
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((_, i) => i !== index);
    });
  }

  /** Frees the previews when the thread closes with images still queued. */
  function clearPending() {
    setPending((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.url);
      return [];
    });
  }

  const timeFmt = new Intl.DateTimeFormat(toBcp47(locale), { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

  return (
    <section className={styles.panel} aria-labelledby="order-chat-title">
      <header className={styles.head}>
        <MessageSquare size={18} strokeWidth={1.9} aria-hidden="true" className={styles.headIcon} />
        <div>
          <h2 id="order-chat-title" className={styles.title}>
            {t.title}
          </h2>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
        {status !== "connected" && (
          <span className={styles.status}>{status === "connecting" || status === "idle" ? t.connecting : t.offline}</span>
        )}
      </header>

      <div className={styles.list} ref={listRef} role="log" aria-live="polite">
        {messages.length === 0 && <p className={styles.empty}>{t.empty}</p>}
        {messages.map((m) => {
          const mine = m.senderType === "guest";
          return (
            <div key={m._clientId ?? m.id} className={`${styles.row} ${mine ? styles.rowMine : ""}`}>
              <div className={`${styles.bubble} ${mine ? styles.bubbleMine : ""}`}>
                <span className={styles.author}>{mine ? t.you : t.shop}</span>
                {m.attachments && m.attachments.length > 0 && (
                  <span className={styles.thumbs}>
                    {m.attachments.map((a, i) => (
                      <button
                        key={a.key}
                        type="button"
                        className={styles.thumb}
                        onClick={() => setViewing({ images: m.attachments ?? [], index: i })}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.thumbUrl} alt="" loading="lazy" className={styles.thumbImg} />
                      </button>
                    ))}
                  </span>
                )}
                {m.content && <p className={styles.text}>{m.content}</p>}
                <span className={styles.meta}>
                  {m._status === "sending" && t.sending}
                  {m._status === "failed" && (
                    <button type="button" className={styles.retry} onClick={() => m._clientId && retryMessage(m._clientId)}>
                      <RotateCcw size={11} strokeWidth={2.2} aria-hidden="true" />
                      {t.failed} · {t.retry}
                    </button>
                  )}
                  {/* Anything not still in flight shows its time. Not `!m._status`:
                      the hook stamps every delivered and every historical message
                      "sent", so that test never passed and no message ever showed
                      a timestamp. */}
                  {m._status !== "sending" && m._status !== "failed" && timeFmt.format(new Date(m.createdAt))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {pending.length > 0 && (
        <div className={styles.pending}>
          {pending.map((p, i) => (
            <span key={p.url} className={styles.pendingItem}>
              {/* Revoked on unmount by the browser when the blob URL's document
                  goes; short-lived enough that holding it is fine. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className={styles.pendingImg} />
              <button
                type="button"
                className={styles.pendingRemove}
                onClick={() => removePending(i)}
                aria-label={t.attachRemove}
              >
                <X size={12} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </span>
          ))}
          <span className={styles.pendingHint}>{t.attachHint}</span>
        </div>
      )}
      {uploadError && <p className={styles.uploadError}>{uploadError}</p>}

      <form className={styles.composer} onSubmit={submit}>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
          multiple
          className={styles.fileInput}
          onChange={(e) => addFiles(e.target.files)}
        />
        <button
          type="button"
          className={styles.attachBtn}
          onClick={() => fileRef.current?.click()}
          aria-label={t.attach}
          title={t.attach}
        >
          <ImagePlus size={17} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <textarea
          ref={draftRef}
          rows={1}
          className={styles.input}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            autoGrow(e.target);
          }}
          onKeyDown={onDraftKeyDown}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          aria-describedby="order-chat-hint"
          maxLength={2000}
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={uploading || (!draft.trim() && pending.length === 0)}
          aria-label={t.send}
        >
          <Send size={16} strokeWidth={2} aria-hidden="true" />
          <span className={styles.sendLabel}>{uploading ? t.attachSending : t.send}</span>
        </button>
      </form>

      <p id="order-chat-hint" className={styles.composerHint}>
        {t.composerHint}
      </p>

      {viewing && (
        <ImageLightbox
          images={viewing.images.map((a) => ({ id: a.key, url: a.url }))}
          initialIndex={viewing.index}
          onClose={() => setViewing(null)}
          ariaLabel={t.attachViewer}
        />
      )}
    </section>
  );
}
