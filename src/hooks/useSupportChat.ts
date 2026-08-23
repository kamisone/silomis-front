"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { WS_HOST, WS_PATH } from "@/lib/wsConfig";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MessageStatus = "sending" | "sent" | "failed";

export interface SupportMessage {
  id: string;
  conversationId: string;
  senderType: "guest" | "admin" | "system";
  senderId: string | null;
  content: string;
  readAt: string | null;
  createdAt: string;
  _clientId?: string;
  _status?: MessageStatus;
  _retryCount?: number;
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

const ACK_TIMEOUT = 8_000;
const ACTIVE_DEBOUNCE = 400;
// Give up after this many consecutive server-initiated disconnects (auth failure loop guard).
const MAX_SERVER_DISCONNECTS = 3;

// ── Module-level ws-ticket cache ──────────────────────────────────────────────
// JWT TTL is 2 min — we cache for 90 s to leave a 30 s renewal buffer.
// Module scope means one cache entry per page regardless of render count.
const wsTicketCache = { value: "", expiresAt: 0 };

async function fetchWsTicket(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && wsTicketCache.value && now < wsTicketCache.expiresAt) {
    return wsTicketCache.value;
  }
  try {
    const res = await fetch("/next-api/support/guest/ws-ticket", { method: "POST" });
    if (!res.ok) return "";
    const data = (await res.json()) as { ticket?: string };
    const ticket = data?.ticket ?? "";
    if (ticket) {
      wsTicketCache.value = ticket;
      wsTicketCache.expiresAt = now + 90_000;
    }
    return ticket;
  } catch {
    return "";
  }
}

function invalidateTicketCache() {
  wsTicketCache.value = "";
  wsTicketCache.expiresAt = 0;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

interface UseSupportChatReturn {
  messages: SupportMessage[];
  status: ConnectionStatus;
  unreadCount: number;
  conversationId: string | null;
  adminTyping: boolean;
  sendMessage: (content: string, guestName?: string) => void;
  retryMessage: (clientId: string) => void;
  markRead: () => void;
  retry: () => void;
  emitTyping: (isTyping: boolean) => void;
}

export function useSupportChat(
  isOpen: boolean,
  // Lazily read at send time (not a plain value) so a stale closure inside
  // doSend's useCallback([]) can't ship a cart snapshot from first render.
  getCheckoutProducts?: () => Array<{ title: string; url: string }> | undefined,
): UseSupportChatReturn {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [adminTyping, setAdminTyping] = useState(false);

  // ── Derived unread count ───────────────────────────────────────────────────
  const unreadCount = messages.filter((m) => m.senderType === "admin" && m.readAt === null && !m.id.startsWith("opt-")).length;

  const socketRef = useRef<Socket | null>(null);
  const convIdRef = useRef<string | null>(null);
  const guestNameRef = useRef<string | undefined>(undefined);
  const pendingRef = useRef<Map<string, { content: string; retryCount: number; timer: ReturnType<typeof setTimeout> }>>(new Map());
  const bootstrappedRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  const activeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<SupportMessage[]>([]);
  const onReconnectRef = useRef<((socket: Socket) => Promise<void>) | null>(null);
  // Counts consecutive server-initiated disconnects to detect auth failure loops.
  const serverDisconnectCountRef = useRef(0);
  // Debounces reconnectIfNeeded so visibilitychange + focus firing together
  // only produce one disconnect/connect cycle and one ws-ticket request.
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getCheckoutProductsRef = useRef(getCheckoutProducts);

  isOpenRef.current = isOpen;
  messagesRef.current = messages;
  getCheckoutProductsRef.current = getCheckoutProducts;

  // ── Passive seen ───────────────────────────────────────────────────────────

  const emitActive = useCallback(() => {
    if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
    activeTimerRef.current = setTimeout(() => {
      activeTimerRef.current = null;
      const socket = socketRef.current;
      if (!socket?.connected) return;
      if (!isOpenRef.current) return;
      if (document.visibilityState !== "visible") return;
      socket.emit("conversation:active");
    }, ACTIVE_DEBOUNCE);
  }, []);

  // ── Send with ACK + timeout ────────────────────────────────────────────────

  const doSend = useCallback((socket: Socket, content: string, clientId: string, retryCount = 0) => {
    setMessages((prev) => prev.map((m) => (m._clientId === clientId ? { ...m, _status: "sending" as MessageStatus, _retryCount: retryCount } : m)));

    const timer = setTimeout(() => {
      pendingRef.current.delete(clientId);
      setMessages((prev) => prev.map((m) => (m._clientId === clientId ? { ...m, _status: "failed" as MessageStatus } : m)));
    }, ACK_TIMEOUT);

    pendingRef.current.set(clientId, { content, retryCount, timer });

    socket.emit(
      "message:send",
      {
        content,
        clientId,
        guestName: guestNameRef.current,
        pageUrl: window.location.href,
        checkoutProducts: getCheckoutProductsRef.current?.(),
      },
      (ack: { ok: boolean; message?: SupportMessage; clientId?: string; error?: string }) => {
        clearTimeout(timer);
        pendingRef.current.delete(clientId);
        if (ack.ok && ack.message) {
          if (!convIdRef.current && ack.message.conversationId) {
            convIdRef.current = ack.message.conversationId;
            setConversationId(ack.message.conversationId);
          }
          setMessages((prev) => prev.map((m) => (m._clientId === clientId ? { ...ack.message!, _clientId: clientId, _status: "sent" as MessageStatus } : m)));
        } else {
          setMessages((prev) => prev.map((m) => (m._clientId === clientId ? { ...m, _status: "failed" as MessageStatus } : m)));
        }
      },
    );
  }, []);

  // ── Reconnect: sync missed messages + retry pending ────────────────────────

  const onReconnect = useCallback(
    async (socket: Socket) => {
      const msgs = messagesRef.current;
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg) {
        socket.emit("guest:sync", { since: lastMsg.createdAt }, (resp: { ok: boolean; messages?: SupportMessage[] }) => {
          if (resp.ok && resp.messages?.length) {
            setMessages((prev) => mergeMessages(prev, resp.messages!.map((m) => ({ ...m, _status: "sent" as MessageStatus }))));
          }
        });
      }

      setMessages((prev) => {
        const toRetry = prev.filter((m) => m._status === "sending" || m._status === "failed");
        for (const msg of toRetry) {
          if (msg._clientId) doSend(socket, msg.content, msg._clientId, (msg._retryCount ?? 0) + 1);
        }
        return prev;
      });

      if (isOpenRef.current) emitActive();
    },
    [emitActive, doSend],
  );

  onReconnectRef.current = onReconnect;

  // ── Bootstrap + connect ────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (socketRef.current) return;
    setStatus("connecting");

    if (!bootstrappedRef.current) {
      try {
        await fetch("/next-api/support/guest/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        bootstrappedRef.current = true;
        // Bootstrap may have just set or refreshed the cookie — stale cached ticket is now wrong.
        invalidateTicketCache();
      } catch {
        /* non-fatal — socket will fail gracefully below */
      }
    }

    try {
      const histRes = await fetch("/next-api/support/guest/history");
      if (histRes.ok) {
        const data = (await histRes.json()) as {
          messages: SupportMessage[];
          conversationId?: string;
        };
        if (data.messages?.length) setMessages((prev) => mergeMessages(prev, data.messages));
        if (data.conversationId) {
          setConversationId(data.conversationId);
          convIdRef.current = data.conversationId;
        }
      }
    } catch {
      /* non-fatal */
    }

    // auth is a callback — socket.io invokes it on every connection attempt (including
    // socket.io's own automatic reconnect retries). Using the module-level cache means
    // rapid reconnects (backoff retries, tab wake-ups) reuse the same JWT instead of
    // hammering the ws-ticket endpoint. If the ticket is missing, we re-bootstrap once
    // to refresh the httpOnly cookie before giving up.
    const socket = io(`${WS_HOST}/support`, {
      auth: (cb: (data: Record<string, unknown>) => void) => {
        const doAuth = async () => {
          let ticket = await fetchWsTicket();

          if (!ticket) {
            // Cookie may be missing or expired — try re-bootstrapping to refresh it.
            try {
              await fetch("/next-api/support/guest/bootstrap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              });
              bootstrappedRef.current = true;
            } catch {
              /* non-fatal */
            }
            // Force-refresh: bypass the (now-empty) cache.
            ticket = await fetchWsTicket(true);
          }

          cb({ guestTicket: ticket });
        };
        doAuth().catch(() => cb({ guestTicket: "" }));
      },
      transports: ["websocket", "polling"],
      path: WS_PATH,
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 15_000,
    });

    socket.on("connected", ({ conversationId: cid }: { role: string; conversationId: string | null }) => {
      setStatus("connected");
      if (cid) {
        setConversationId(cid);
        convIdRef.current = cid;
      }
      if (isOpenRef.current) emitActive();
    });

    socket.on("message:new", (msg: SupportMessage & { clientId?: string }) => {
      const normalized: SupportMessage = {
        ...msg,
        _clientId: msg.clientId ?? msg._clientId,
        _status: "sent",
      };
      setMessages((prev) => mergeMessages(prev, [normalized]));
      if (msg.senderType === "admin" && isOpenRef.current && document.visibilityState === "visible") {
        emitActive();
      }
    });

    socket.on(
      "messages:seen",
      ({
        seenAt,
        messageIds,
      }: {
        seenBy: string;
        seenAt: string;
        messageIds: string[];
      }) => {
        setMessages((prev) => prev.map((m) => (messageIds.includes(m.id) ? { ...m, readAt: seenAt } : m)));
      },
    );

    socket.on("user:typing", ({ senderType, isTyping }: { senderType: string; isTyping: boolean }) => {
      if (senderType === "admin") setAdminTyping(isTyping);
    });

    socket.on("connect", async () => {
      setStatus("connected");
      // Successful connection — reset the server-disconnect counter.
      serverDisconnectCountRef.current = 0;
      await onReconnectRef.current?.(socket);
    });

    socket.on("disconnect", (reason) => {
      setAdminTyping(false);
      setStatus("disconnected");

      if (reason === "io server disconnect") {
        serverDisconnectCountRef.current++;

        if (serverDisconnectCountRef.current >= MAX_SERVER_DISCONNECTS) {
          // The server keeps rejecting us — almost certainly an auth issue.
          // Stop reconnecting automatically to break the infinite loop.
          // The user can click "Retry" to start fresh.
          setStatus("error");
          return;
        }

        // Invalidate the cached ticket so the next auth attempt fetches a fresh one —
        // the server may have rejected the previous ticket as expired or invalid.
        invalidateTicketCache();
        setTimeout(() => socket.connect(), 2_000);
      }
    });

    // Show "disconnected" while socket.io retries automatically.
    socket.on("connect_error", () => setStatus("disconnected"));

    socketRef.current = socket;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reconnect without creating a new socket ────────────────────────────────
  // Debounced with a 150 ms window: when the browser fires both visibilitychange
  // and focus at once (tab switch), only one disconnect/connect cycle runs —
  // preventing two simultaneous auth callbacks and two ws-ticket requests.

  const reconnectIfNeeded = useCallback(() => {
    if (reconnectTimerRef.current) return; // already scheduled for this burst
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      const socket = socketRef.current;
      if (!socket) {
        connect();
        return;
      }
      if (socket.connected) return;
      // disconnect() resets socket.io's internal backoff timer so the
      // subsequent connect() starts immediately instead of waiting.
      socket.disconnect();
      socket.connect();
    }, 150);
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  // ── Reconnect + passive seen on visibility / network / focus ──────────────

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        reconnectIfNeeded();
        if (isOpenRef.current) emitActive();
      }
    };
    const onOnline = () => reconnectIfNeeded();
    const onFocus = () => reconnectIfNeeded();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);

    if (isOpen) emitActive();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, [isOpen, emitActive, reconnectIfNeeded]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (content: string, guestName?: string) => {
      const socket = socketRef.current;
      if (!socket?.connected || !content.trim()) return;
      if (guestName && !guestNameRef.current) guestNameRef.current = guestName;

      const clientId = crypto.randomUUID();
      const optimistic: SupportMessage = {
        id: `opt-${clientId}`,
        conversationId: convIdRef.current ?? "",
        senderType: "guest",
        senderId: null,
        content: content.trim(),
        readAt: null,
        createdAt: new Date().toISOString(),
        _clientId: clientId,
        _status: "sending",
      };

      setMessages((prev) => [...prev, optimistic]);
      doSend(socket, content.trim(), clientId);
    },
    [doSend],
  );

  const retryMessage = useCallback(
    (clientId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      setMessages((prev) => {
        const msg = prev.find((m) => m._clientId === clientId);
        if (msg) doSend(socket, msg.content, clientId, (msg._retryCount ?? 0) + 1);
        return prev;
      });
    },
    [doSend],
  );

  const markRead = useCallback(() => {
    emitActive();
  }, [emitActive]);

  const retry = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    bootstrappedRef.current = false;
    serverDisconnectCountRef.current = 0;
    invalidateTicketCache();
    setStatus("idle");
    connect();
  }, [connect]);

  const emitTyping = useCallback((isTyping: boolean) => {
    socketRef.current?.emit("typing", { isTyping });
  }, []);

  return { messages, status, unreadCount, conversationId, adminTyping, sendMessage, retryMessage, markRead, retry, emitTyping };
}

// ── Utility: merge + dedup by id ──────────────────────────────────────────────

function mergeMessages(existing: SupportMessage[], incoming: SupportMessage[]): SupportMessage[] {
  const map = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) {
    const placeholder = existing.find((e) => e._clientId && e._clientId === m._clientId && e.id.startsWith("opt-"));
    if (placeholder) map.delete(placeholder.id);
    map.set(m.id, { ...m, _status: m._status ?? "sent" });
  }
  return Array.from(map.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
