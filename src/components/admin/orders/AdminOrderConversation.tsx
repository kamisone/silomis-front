"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { ImagePlus, RotateCcw, Send, X } from "lucide-react";
import { WS_HOST, WS_PATH } from "@/lib/wsConfig";
import ImageLightbox from "@/components/shop/ImageLightbox";
import styles from "./AdminOrderConversation.module.css";

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
  const [pending, setPending] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [viewing, setViewing] = useState<{ images: Attachment[]; index: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
        for (const file of pending) body.append("images", file);
        const res = await fetch(`/next-api/support/admin/orders/${encodeURIComponent(orderId)}/attachments`, {
          method: "POST",
          body,
        });
        if (!res.ok) throw new Error("upload failed");
        setPending([]);
        setDraft("");
      } catch {
        setUploadError("That photo could not be sent. Try another file.");
      } finally {
        setUploading(false);
      }
      return;
    }

    send(content);
    setDraft("");
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadError("");
    setPending((prev) => {
      const next = [...prev, ...Array.from(files)];
      if (next.length > 4) {
        setUploadError("At most 4 photos at a time.");
        return next.slice(0, 4);
      }
      return next;
    });
    if (fileRef.current) fileRef.current.value = "";
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
          {pending.map((file, i) => (
            <span key={`${file.name}-${i}`} className={styles.pendingItem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(file)} alt="" className={styles.pendingImg} />
              <button
                type="button"
                className={styles.pendingRemove}
                onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
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
        <input
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write to the customer…"
          aria-label="Write to the customer"
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
