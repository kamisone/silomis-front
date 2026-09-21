"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, MessageSquare, RotateCcw, Send, X } from "lucide-react";
import { orderTransport, useSupportChat, type MessageAttachment } from "@/hooks/useSupportChat";
import ImageLightbox from "./ImageLightbox";
import { getTranslations, toBcp47, type Locale } from "@/lib/i18n";
import styles from "./OrderConversation.module.css";

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
  const [pending, setPending] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [viewing, setViewing] = useState<{ images: MessageAttachment[]; index: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
        for (const file of pending) body.append("images", file);
        const res = await fetch(
          `/next-api/public/shop/orders/${encodeURIComponent(orderNumber)}/conversation/attachments`,
          { method: "POST", body },
        );
        if (!res.ok) throw new Error("upload failed");
        setPending([]);
        setDraft("");
      } catch {
        setUploadError(t.attachFailed);
      } finally {
        setUploading(false);
      }
      return;
    }

    sendMessage(content);
    setDraft("");
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadError("");
    setPending((prev) => {
      const next = [...prev, ...Array.from(files)];
      if (next.length > 4) {
        setUploadError(t.attachTooMany);
        return next.slice(0, 4);
      }
      return next;
    });
    // Cleared so choosing the same file twice in a row still fires onChange.
    if (fileRef.current) fileRef.current.value = "";
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
          {pending.map((file, i) => (
            <span key={`${file.name}-${i}`} className={styles.pendingItem}>
              {/* Revoked on unmount by the browser when the blob URL's document
                  goes; short-lived enough that holding it is fine. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(file)} alt="" className={styles.pendingImg} />
              <button
                type="button"
                className={styles.pendingRemove}
                onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
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
        <input
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
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
