"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { ImagePlus, RotateCcw, Send, X } from "lucide-react";
import { WS_HOST, WS_PATH } from "@/lib/wsConfig";
import ImageLightbox from "@/components/shop/ImageLightbox";
import styles from "./AdminOrderConversation.module.css";

/** Must match ATTACHMENT_MAX_FILES on the server, which refuses more. */
const MAX_IMAGES = 4;

/** A picked file and the blob URL its preview renders from. */
interface PendingImage {
  file: File;
  url: string;
}

interface Attachment {
  key: string;
  url: string;
  thumbUrl: string;
}

interface Message {
  id: string;
  senderType: "guest" | "admin" | "system";
  content: string;
  attachments?: Attachment[] | null;
  createdAt: string;
  _clientId?: string;
  _failed?: boolean;
}

/**
 * The shop's half of an order conversation, on the order it is about.
 *
 * A deliberate second entry point rather than a link into the support inbox:
 * the question is almost always about the order, so the answer wants the order
 * on screen — the design, the sizes, the address, the status — not a
 * conversation list.
 *
 * Its own small socket client rather than the inbox's: AdminSupport drives a
 * whole conversation list with assignment, filters and analytics, none of
 * which applies to a single thread bound to one order. What the two share is
 * the gateway, so a reply sent here reaches the inbox and the customer's tab
 * immediately.
 */
export default function AdminOrderConversation({
  orderId,
  orderNumber,
  onUnread,
}: {
  orderId: string;
  orderNumber: string;
  /** Called with the thread's unread count — 0 once this tab has read it. */
  onUnread?: (count: number) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [viewing, setViewing] = useState<{ images: Attachment[]; index: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const convIdRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /** Keyed by id, oldest first — so the socket's echo of our own message
   *  replaces the optimistic row instead of doubling it. */
  const merge = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, { ...map.get(m.id), ...m });
      return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  // ── History, then socket ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/next-api/support/admin/orders/${encodeURIComponent(orderId)}/conversation`);
        if (res.ok) {
          const data = (await res.json()) as { conversationId: string | null; messages: Message[] };
          if (cancelled) return;
          convIdRef.current = data.conversationId;
          merge(data.messages ?? []);
          // Opening this tab is reading the thread: the gateway marks the
          // messages seen below, so the badge is spent the moment it renders.
          onUnread?.(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      const ticketRes = await fetch("/next-api/support/ws-ticket").catch(() => null);
      if (!ticketRes?.ok || cancelled) return;
      const { token } = (await ticketRes.json()) as { token: string };

      const socket = io(`${WS_HOST}/support`, {
        auth: { adminToken: token },
        path: WS_PATH,
        transports: ["websocket"],
      });
      socketRef.current = socket;

      socket.on("connected", () => {
        setConnected(true);
        // Only an existing thread has a room to join. A new one is joined by
        // the gateway as it creates it, on this admin's first message.
        if (convIdRef.current) {
          socket.emit("admin:join:conversation", { conversationId: convIdRef.current });
          // Clears unreadAdminCount server-side, which is what the Orders
          // badge and the list markers read.
          socket.emit("conversation:active", {});
        }
      });
      socket.on("disconnect", () => setConnected(false));
      socket.on("message:new", (m: Message) => merge([m]));
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [orderId, merge, onUnread]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(
    (content: string, clientId = `c-${Date.now()}-${Math.random().toString(36).slice(2)}`) => {
      const socket = socketRef.current;
      if (!socket) return;

      setMessages((prev) => [
        ...prev.filter((m) => m._clientId !== clientId),
        { id: clientId, senderType: "admin", content, createdAt: new Date().toISOString(), _clientId: clientId },
      ]);

      // Always the order-keyed event: the thread may not exist yet, and this
      // is the one path that opens it. Once it does, the gateway takes the
      // same branch as any other admin reply.
      socket.emit(
        "admin:order:message:send",
        { orderId, content, clientId },
        (ack: { ok: boolean; message?: Message; conversationId?: string }) => {
          if (!ack?.ok) {
            setMessages((prev) => prev.map((m) => (m._clientId === clientId ? { ...m, _failed: true } : m)));
            return;
          }
          if (ack.conversationId && !convIdRef.current) {
            convIdRef.current = ack.conversationId;
            socket.emit("admin:join:conversation", { conversationId: ack.conversationId });
          }
          setMessages((prev) => prev.filter((m) => m._clientId !== clientId));
          if (ack.message) merge([ack.message]);
        },
      );
    },
    [orderId, merge],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content && pending.length === 0) return;

    // Images take the HTTP path, which creates the message and broadcasts it;
    // text takes the socket. Mirrors the customer's composer.
    if (pending.length > 0) {
      setUploading(true);
      setUploadError("");
      try {
        const body = new FormData();
        if (content) body.append("content", content);
        for (const p of pending) body.append("images", p.file);
        const res = await fetch(`/next-api/support/admin/orders/${encodeURIComponent(orderId)}/attachments`, {
          method: "POST",
          body,
        });
        if (!res.ok) throw new Error("upload failed");
        clearPending();
        setDraft("");
        if (draftRef.current) draftRef.current.style.height = "auto";
      } catch {
        setUploadError("That photo could not be sent. Try another file.");
      } finally {
        setUploading(false);
      }
      return;
    }

    send(content);
    setDraft("");
    if (draftRef.current) draftRef.current.style.height = "auto";
  }

  /**
   * Grows the box with the text, to a few lines, then scrolls. Scripted
   * rather than `field-sizing: content`, which is not in Firefox or Safari
   * yet — see the customer's composer, which does the same.
   */
  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function onDraftKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift + Enter breaks the line. `isComposing` guards an IME:
    // mid-composition, Enter is choosing a character, not sending.
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

    setUploadError(merged.length > MAX_IMAGES ? "At most 4 photos at a time." : "");
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

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <strong className={styles.title}>Messages with the customer</strong>
        <span className={styles.hint}>{connected ? `Live · ${orderNumber}` : "Connecting…"}</span>
      </div>

      <div className={styles.list} ref={listRef} role="log" aria-live="polite">
        {loading && <p className={styles.empty}>Loading…</p>}
        {!loading && messages.length === 0 && (
          <p className={styles.empty}>No messages yet. Write to the customer and the thread opens here.</p>
        )}
        {messages.map((m) => {
          const mine = m.senderType === "admin";
          return (
            <div key={m._clientId ?? m.id} className={`${styles.row} ${mine ? styles.rowMine : ""}`}>
              <div className={`${styles.bubble} ${mine ? styles.bubbleMine : ""} ${m._failed ? styles.bubbleFailed : ""}`}>
                <span className={styles.author}>{mine ? "You" : "Customer"}</span>
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
                  {m._failed ? (
                    <button type="button" className={styles.retry} onClick={() => send(m.content, m._clientId)}>
                      <RotateCcw size={11} aria-hidden="true" /> Not sent · Retry
                    </button>
                  ) : (
                    new Date(m.createdAt).toLocaleString()
                  )}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className={styles.pendingImg} />
              <button
                type="button"
                className={styles.pendingRemove}
                onClick={() => removePending(i)}
                aria-label="Remove"
              >
                <X size={11} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </span>
          ))}
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
        <button type="button" className={styles.attachBtn} onClick={() => fileRef.current?.click()} title="Add a photo" aria-label="Add a photo">
          <ImagePlus size={16} aria-hidden="true" />
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
          placeholder="Write to the customer…"
          aria-label="Write to the customer"
          aria-describedby="admin-order-chat-hint"
          maxLength={2000}
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={uploading || !connected || (!draft.trim() && pending.length === 0)}
        >
          <Send size={15} aria-hidden="true" /> {uploading ? "Sending…" : "Send"}
        </button>
      </form>

      <p id="admin-order-chat-hint" className={styles.composerHint}>
        Enter to send · Shift + Enter for a new line
      </p>

      {viewing && (
        <ImageLightbox
          images={viewing.images.map((a) => ({ id: a.key, url: a.url }))}
          initialIndex={viewing.index}
          onClose={() => setViewing(null)}
          ariaLabel="Photos in this conversation"
        />
      )}
    </div>
  );
}
