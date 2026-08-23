"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { WS_HOST, WS_PATH } from "@/lib/wsConfig";
import styles from "./AdminSupport.module.css";
import { X, Headphones, SlidersHorizontal, Search, Menu, MessageCircle, CheckCircle2, RotateCcw, Trash2, Send } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  guestToken: string;
  guestName: string | null;
  pageUrl: string | null;
  checkoutProducts: Array<{ title: string; url: string }> | null;
  assignedAdminId: string | null;
  status: string;
  lastMessageAt: string | null;
  unreadAdminCount: number;
  firstResponseAt: string | null;
  createdAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderType: "guest" | "admin" | "system";
  senderId: string | null;
  content: string;
  readAt: string | null;
  createdAt: string;
  // Admin-side lifecycle
  _clientId?: string;
  _status?: "sending" | "sent" | "failed";
}

interface NotifSettings {
  smsEnabled:         boolean;
  smsPhones:          string[];
  smsCooldownMin:     number;
  inactiveCloseHours: number;
}

interface Analytics {
  totalConversations:  number;
  openConversations:   number;
  closedToday:         number;
  unresolvedCount:     number;
  avgFirstResponseMs:  number | null;
  messageVolumeByDay:  { date: string; count: number }[];
  peakHours:           { hour: number; count: number }[];
}

type FilterStatus = "all" | "open" | "waiting_admin" | "waiting_guest" | "closed" | "archived";
type Tab = "conversations" | "analytics";

const ACK_TIMEOUT = 8_000;

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  waiting_admin: "Waiting",
  waiting_guest: "Replied",
  closed: "Closed",
  archived: "Archived",
};

const SYSTEM_MESSAGES: Record<string, string> = {
  auto_closed: "This conversation was automatically closed due to inactivity.",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

// Cache formatters — Intl object creation is expensive
const rtfCache = new Map<string, Intl.RelativeTimeFormat>();
function rtf(locale: string) {
  if (!rtfCache.has(locale))
    rtfCache.set(locale, new Intl.RelativeTimeFormat(locale, { numeric: "auto" }));
  return rtfCache.get(locale)!;
}

function relTime(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const fmt  = rtf(locale);
  if (diff < 60_000)     return fmt.format(-Math.floor(diff / 1_000),    "second");
  if (diff < 3_600_000)  return fmt.format(-Math.floor(diff / 60_000),   "minute");
  if (diff < 86_400_000) return fmt.format(-Math.floor(diff / 3_600_000),"hour");
  return fmt.format(-Math.floor(diff / 86_400_000), "day");
}

function fmtMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 60_000)    return `${Math.round(ms / 1_000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

function statusClass(s: string, css: Record<string, string>): string {
  return ({ open: css.statusOpen, waiting_admin: css.statusWaiting, waiting_guest: css.statusReplied, closed: css.statusClosed, archived: css.statusClosed })[s] ?? "";
}

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}

// Last admin message that the guest has read
function lastSeenAdminMsgId(msgs: Message[]): string | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].senderType === "admin" && msgs[i].readAt) return msgs[i].id;
  }
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminSupport() {
  const locale = "en" as const;

  const router      = useRouter();
  const searchParams = useSearchParams();
  const urlConvId    = searchParams.get("conv");

  // Push/replace ?conv param without touching other query params.
  const pushConvUrl = useCallback((id: string) => {
    const p = new URLSearchParams(window.location.search);
    p.set("conv", id);
    router.push(`${window.location.pathname}?${p}`, { scroll: false });
  }, [router]);

  const clearConvUrl = useCallback(() => {
    const p = new URLSearchParams(window.location.search);
    p.delete("conv");
    const qs = p.toString();
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { scroll: false });
  }, [router]);

  // Ref keeps the WS handler (closed over once in a [] effect) pointing at the
  // always-fresh clearConvUrl without adding it to the effect's dep array.
  const clearConvUrlRef = useRef(clearConvUrl);
  useEffect(() => { clearConvUrlRef.current = clearConvUrl; }, [clearConvUrl]);

  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [tab,             setTab]             = useState<Tab>("conversations");
  const [conversations,   setConversations]   = useState<Conversation[]>([]);
  const [selectedId,      setSelectedId]      = useState<string | null>(null);
  const [messages,        setMessages]        = useState<Message[]>([]);
  const [filter,          setFilter]          = useState<FilterStatus>("all");
  const [search,          setSearch]          = useState("");
  const [input,           setInput]           = useState("");
  const [loading,         setLoading]         = useState(true);
  const [msgLoading,      setMsgLoading]      = useState(false);
  const [settings,        setSettings]        = useState<NotifSettings | null>(null);
  const [showSettings,    setShowSettings]    = useState(false);
  const [phoneDraft,      setPhoneDraft]      = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [wsStatus,        setWsStatus]        = useState<"connecting" | "connected" | "error" | "disconnected">("connecting");
  const [analytics,       setAnalytics]       = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [guestTyping,     setGuestTyping]     = useState<Record<string, boolean>>({});

  const socketRef        = useRef<Socket | null>(null);
  const bottomRef        = useRef<HTMLDivElement>(null);
  const filterRef        = useRef<FilterStatus>("all");
  const searchRef        = useRef("");
  const typingTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { filterRef.current = filter; }, [filter]);
  useEffect(() => { searchRef.current = search; }, [search]);
  const pendingRef       = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const selectedIdRef    = useRef<string | null>(null);
  const activeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalTitleRef = useRef<string>("");

  useEffect(() => { originalTitleRef.current = document.title; }, []);

  useEffect(() => {
    if (!originalTitleRef.current) return;
    const total = conversations.reduce((s, c) => s + c.unreadAdminCount, 0);
    document.title = total > 0
      ? total === 1 ? "New support message" : `(${total}) New support messages`
      : originalTitleRef.current;
  }, [conversations]);

  useEffect(() => () => { if (originalTitleRef.current) document.title = originalTitleRef.current; }, []);

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const selected  = conversations.find(c => c.id === selectedId) ?? null;
  const seenMsgId = lastSeenAdminMsgId(messages);

  // ── Passive seen: emit conversation:active ─────────────────────────────────

  const emitActive = useCallback(() => {
    if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
    activeTimerRef.current = setTimeout(() => {
      activeTimerRef.current = null;
      const socket = socketRef.current;
      const id     = selectedIdRef.current;
      if (!socket?.connected || !id || document.visibilityState !== "visible") return;
      socket.emit("conversation:active", { conversationId: id });
      // Optimistic: clear local unread count for this conversation
      setConversations(prev => prev.map(c => c.id === id ? { ...c, unreadAdminCount: 0 } : c));
    }, 400);
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    fetch("/next-api/support/ws-ticket")
      .then(r => r.ok ? r.json() : null)
      .then((data: { token: string } | null) => {
        if (cancelled || !data?.token) return;

        const socket = io(`${WS_HOST}/support`, {
          auth:                 { adminToken: data.token },
          transports:           ["websocket", "polling"],
          path:                 WS_PATH,
          reconnectionDelay:    2_000,
          reconnectionDelayMax: 15_000,
        });

        socket.on("connected",     () => setWsStatus("connected"));
        socket.on("connect_error", () => setWsStatus("error"));
        socket.on("disconnect",    () => setWsStatus("disconnected"));

        // Re-join the selected conversation room after a reconnect so the
        // server continues forwarding messages for that conversation.
        socket.on("connect", () => {
          const id = selectedIdRef.current;
          if (id) socket.emit("admin:join:conversation", { conversationId: id });
        });

        socket.on("message:new", (msg: Message & { clientId?: string }) => {
          const incomingClientId = msg.clientId ?? msg._clientId;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            if (incomingClientId && prev.some(m => m._clientId === incomingClientId)) return prev;
            return [...prev, { ...msg, _clientId: incomingClientId, _status: "sent" as const }];
          });
          // If this message is in the currently viewed conversation and the tab is
          // visible, auto-mark it as read without requiring any user action.
          if (msg.senderType === "guest" && msg.conversationId === selectedIdRef.current) {
            emitActive();
          }
        });

        socket.on("messages:seen", ({ seenAt, messageIds }: { seenBy: string; seenAt: string; messageIds: string[] }) => {
          setMessages(prev => prev.map(m => messageIds.includes(m.id) ? { ...m, readAt: seenAt } : m));
        });

        socket.on("conversation:new", (conv: Conversation) => {
          setConversations(prev => {
            if (prev.some(c => c.id === conv.id)) return prev;
            const f = filterRef.current;
            const q = searchRef.current.toLowerCase();
            const passesFilter = f === "all" || f === conv.status;
            const passesSearch = !q || (conv.guestName ?? conv.guestToken).toLowerCase().includes(q);
            if (!passesFilter || !passesSearch) return prev;
            return [conv, ...prev];
          });
        });

        socket.on("conversation:update", (update: Partial<Conversation> & { id: string; deleted?: boolean }) => {
          if (update.deleted) {
            setConversations(prev => prev.filter(c => c.id !== update.id));
            if (selectedIdRef.current === update.id) {
              setSelectedId(null);
              setMessages([]);
              clearConvUrlRef.current();
            }
            return;
          }
          setConversations(prev => {
            const updated = prev.map(c => c.id === update.id ? { ...c, ...update } : c);
            if (!update.lastMessageAt) return updated;
            return [...updated].sort((a, b) => {
              const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return tb - ta;
            });
          });
        });

        socket.on("user:typing", ({ conversationId, senderType, isTyping }: {
          conversationId: string; senderType: string; isTyping: boolean;
        }) => {
          if (senderType === "guest") {
            setGuestTyping(prev => ({ ...prev, [conversationId]: isTyping }));
          }
        });

        socketRef.current = socket;
      })
      .catch(() => setWsStatus("error"));

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Emit active when admin selects a conversation
  useEffect(() => { if (selectedId) emitActive(); }, [selectedId, emitActive]);

  // Reconnect + emit active when tab regains focus or network returns
  useEffect(() => {
    const forceReconnect = () => {
      const s = socketRef.current;
      if (s && !s.connected) { s.disconnect(); s.connect(); }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        forceReconnect();
        if (selectedIdRef.current) emitActive();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", forceReconnect);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", forceReconnect);
    };
  }, [emitActive]);

  // ── Conversations ──────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filter !== "all") qs.set("status", filter);
      if (search) qs.set("search", search);
      const res = await fetch(`/next-api/support/admin/conversations?${qs}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as { conversations: Conversation[] };
        setConversations(data.conversations ?? []);
      }
    } finally { setLoading(false); }
  }, [filter, search]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load messages + join socket room — no URL side effect.
  // Called both by selectConversation (user click) and the URL-reaction effect
  // (back/forward navigation, initial page load with ?conv=…).
  const loadConversationById = useCallback(async (id: string) => {
    setSelectedId(id);
    setMsgLoading(true);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unreadAdminCount: 0 } : c));
    socketRef.current?.emit("admin:join:conversation", { conversationId: id });
    try {
      const res = await fetch(`/next-api/support/admin/conversations/${id}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as { messages: Message[] };
        setMessages((data.messages ?? []).map(m => ({ ...m, _status: "sent" as const })));
      }
    } finally { setMsgLoading(false); }
  }, []);

  // User-initiated selection: load data + push ?conv=<id> into history.
  const selectConversation = useCallback((id: string) => {
    loadConversationById(id);
    pushConvUrl(id);
    setDrawerOpen(false);
  }, [loadConversationById, pushConvUrl]);

  // React to URL changes from back/forward navigation and direct URL loads.
  useEffect(() => {
    if (!urlConvId) {
      if (selectedIdRef.current !== null) { setSelectedId(null); setMessages([]); }
      return;
    }
    if (urlConvId === selectedIdRef.current) return;
    loadConversationById(urlConvId);
  }, [urlConvId, loadConversationById]);

  // ── Send with ACK ──────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value.slice(0, 2000));
    const socket = socketRef.current;
    if (!selectedId || !socket?.connected) return;
    socket.emit("typing", { conversationId: selectedId, isTyping: true });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit("typing", { conversationId: selectedId, isTyping: false });
    }, 2000);
  };

  const sendMessage = () => {
    const socket = socketRef.current;
    if (!selectedId || !input.trim() || wsStatus !== "connected" || !socket) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    socket.emit("typing", { conversationId: selectedId, isTyping: false });

    const clientId = crypto.randomUUID();
    const optimistic: Message = {
      id: `opt-${clientId}`, conversationId: selectedId,
      senderType: "admin", senderId: null,
      content: input.trim(), readAt: null,
      createdAt: new Date().toISOString(),
      _clientId: clientId, _status: "sending",
    };

    setMessages(prev => [...prev, optimistic]);
    setInput("");

    const timer = setTimeout(() => {
      pendingRef.current.delete(clientId);
      setMessages(prev => prev.map(m => m._clientId === clientId ? { ...m, _status: "failed" } : m));
    }, ACK_TIMEOUT);

    pendingRef.current.set(clientId, timer);

    socket.emit(
      "admin:message:send",
      { conversationId: selectedId, content: optimistic.content, clientId },
      (ack: { ok: boolean; message?: Message; clientId?: string }) => {
        clearTimeout(timer);
        pendingRef.current.delete(clientId);
        if (ack.ok && ack.message) {
          setMessages(prev => prev.map(m =>
            m._clientId === clientId ? { ...ack.message!, _clientId: clientId, _status: "sent" } : m,
          ));
        } else {
          setMessages(prev => prev.map(m => m._clientId === clientId ? { ...m, _status: "failed" } : m));
        }
      },
    );
  };

  const retryAdminMessage = (clientId: string) => {
    const socket = socketRef.current;
    const msg = messages.find(m => m._clientId === clientId);
    if (!msg || !socket || wsStatus !== "connected") return;

    setMessages(prev => prev.map(m => m._clientId === clientId ? { ...m, _status: "sending" } : m));

    const timer = setTimeout(() => {
      pendingRef.current.delete(clientId);
      setMessages(prev => prev.map(m => m._clientId === clientId ? { ...m, _status: "failed" } : m));
    }, ACK_TIMEOUT);
    pendingRef.current.set(clientId, timer);

    socket.emit(
      "admin:message:send",
      { conversationId: selectedId, content: msg.content, clientId },
      (ack: { ok: boolean; message?: Message }) => {
        clearTimeout(timer);
        pendingRef.current.delete(clientId);
        if (ack.ok && ack.message) {
          setMessages(prev => prev.map(m =>
            m._clientId === clientId ? { ...ack.message!, _clientId: clientId, _status: "sent" } : m,
          ));
        } else {
          setMessages(prev => prev.map(m => m._clientId === clientId ? { ...m, _status: "failed" } : m));
        }
      },
    );
  };

  // ── Admin actions ──────────────────────────────────────────────────────────

  const setStatus = async (id: string, status: string) => {
    await fetch(`/next-api/support/admin/conversations/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const deleteConversation = async (id: string) => {
    await fetch(`/next-api/support/admin/conversations/${id}`, { method: "DELETE" });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (selectedId === id) { setSelectedId(null); setMessages([]); clearConvUrl(); }
    setDeleteConfirmId(null);
  };

  // ── Settings ───────────────────────────────────────────────────────────────

  const loadSettings = async () => {
    const res = await fetch("/next-api/support/admin/settings");
    if (res.ok) setSettings(await res.json());
  };

  const saveSettings = async () => {
    if (!settings) return;
    await fetch("/next-api/support/admin/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  };

  const addPhone = () => {
    const p = phoneDraft.trim();
    if (!p || settings?.smsPhones.includes(p)) return;
    setSettings(s => s ? { ...s, smsPhones: [...s.smsPhones, p] } : s);
    setPhoneDraft("");
  };

  useEffect(() => { if (showSettings) loadSettings(); }, [showSettings]);  

  // ── Analytics ──────────────────────────────────────────────────────────────

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch("/next-api/support/admin/analytics", { cache: "no-store" });
      if (res.ok) setAnalytics(await res.json());
    } finally { setAnalyticsLoading(false); }
  }, []);

  useEffect(() => { if (tab === "analytics") loadAnalytics(); }, [tab, loadAnalytics]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const filtered = conversations.filter(c =>
    (filter === "all" || c.status === filter) &&
    (!search || (c.guestName ?? c.guestToken).toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className={styles.page}>

      {/* ── Drawer backdrop (mobile only) ── */}
      {drawerOpen && (
        <div className={styles.drawerBackdrop} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      {/* ── Sidebar / Drawer ── */}
      <aside className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarHeader}>
          <h1 className={styles.sidebarTitle}>
            <Headphones size={16} strokeWidth={1.75} />
            Support
          </h1>
          <div className={styles.sidebarActions}>
            <span className={`${styles.wsIndicator} ${wsStatus === "connected" ? styles.wsGreen : styles.wsRed}`} title={wsStatus} />
            <button className={styles.settingsBtn} onClick={() => setShowSettings(true)} title="Notification Settings">
              <SlidersHorizontal size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className={styles.tabRow}>
          <button className={`${styles.tabBtn} ${tab === "conversations" ? styles.tabBtnActive : ""}`} onClick={() => setTab("conversations")}>Conversations</button>
          <button className={`${styles.tabBtn} ${tab === "analytics"    ? styles.tabBtnActive : ""}`} onClick={() => setTab("analytics")}>Analytics</button>
        </div>

        {tab === "conversations" && <>
          <div className={styles.searchWrap}>
            <Search size={16} strokeWidth={1.75} className={styles.searchIcon} />
            <input className={styles.searchInput} placeholder="Search guest name…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className={styles.filterTabs}>
            {(["all","waiting_admin","open","waiting_guest","closed","archived"] as FilterStatus[]).map(f => (
              <button key={f} className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : statusLabel(f)}
              </button>
            ))}
          </div>

          <div className={styles.convList}>
            {loading && <p className={styles.loadingMsg}>Loading…</p>}
            {!loading && filtered.length === 0 && <p className={styles.emptyMsg}>No conversations</p>}
            {filtered.map(conv => (
              <button key={conv.id} className={`${styles.convItem} ${selectedId === conv.id ? styles.convItemActive : ""}`} onClick={() => selectConversation(conv.id)}>
                <div className={styles.convItemTop}>
                  <span className={styles.convGuestName}>{conv.guestName ?? conv.guestToken.slice(0, 8).toUpperCase()}</span>
                  <span className={styles.convTime}>{relTime(conv.lastMessageAt, locale)}</span>
                </div>
                <div className={styles.convItemBottom}>
                  <span className={`${styles.statusBadge} ${statusClass(conv.status, styles)}`}>{statusLabel(conv.status)}</span>
                  {conv.unreadAdminCount > 0 && <span className={styles.unreadBadge}>{conv.unreadAdminCount}</span>}
                </div>
              </button>
            ))}
          </div>
        </>}

        {tab === "analytics" && (
          <div className={styles.analyticsPanel}>
            {analyticsLoading && <p className={styles.loadingMsg}>Loading…</p>}
            {analytics && <>
              <div className={styles.statGrid}>
                <div className={styles.stat}><span className={styles.statVal}>{analytics.totalConversations}</span><span className={styles.statLabel}>Total conversations</span></div>
                <div className={styles.stat}><span className={styles.statVal}>{analytics.openConversations}</span><span className={styles.statLabel}>Open</span></div>
                <div className={styles.stat}><span className={styles.statVal}>{analytics.closedToday}</span><span className={styles.statLabel}>Closed today</span></div>
                <div className={styles.stat}><span className={`${styles.statVal} ${analytics.unresolvedCount > 0 ? styles.statValWarn : ""}`}>{analytics.unresolvedCount}</span><span className={styles.statLabel}>Unresolved</span></div>
              </div>
              <div className={styles.statFull}>
                <span className={styles.statLabel}>Avg. first response</span>
                <span className={styles.statVal}>{fmtMs(analytics.avgFirstResponseMs)}</span>
              </div>
              <div className={styles.chartSection}>
                <p className={styles.chartTitle}>Message volume (last 14 days)</p>
                <div className={styles.barChart}>
                  {analytics.messageVolumeByDay.slice(-14).map(d => {
                    const max = Math.max(...analytics.messageVolumeByDay.map(x => x.count), 1);
                    return (
                      <div key={d.date} className={styles.barWrap} title={`${d.date}: ${d.count}`}>
                        <div className={styles.bar} style={{ height: `${Math.round((d.count / max) * 100)}%` }} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={styles.chartSection}>
                <p className={styles.chartTitle}>Peak hours</p>
                <div className={styles.barChart}>
                  {analytics.peakHours.map(h => {
                    const max = Math.max(...analytics.peakHours.map(x => x.count), 1);
                    return (
                      <div key={h.hour} className={styles.barWrap} title={`${h.hour}:00 — ${h.count}`}>
                        <div className={styles.bar} style={{ height: `${Math.round((h.count / max) * 100)}%` }} />
                        <span className={styles.barLabel}>{h.hour}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>}
          </div>
        )}
      </aside>

      {/* ── Chat pane ── */}
      <main className={styles.chat}>
        {!selected ? (
          <div className={styles.emptyChat}>
            <button className={styles.drawerToggle} onClick={() => setDrawerOpen(true)} aria-label="Open conversations">
              <Menu size={16} strokeWidth={1.75} />
            </button>
            <MessageCircle size={48} strokeWidth={1.75} className={styles.emptyChatIcon} />
            <p>Select a conversation to view messages</p>
          </div>
        ) : (
          <>
            <div className={styles.chatHeader}>
              <button className={styles.drawerToggle} onClick={() => setDrawerOpen(true)} aria-label="Open conversations">
                <Menu size={16} strokeWidth={1.75} />
              </button>
              <div>
                <p className={styles.chatGuestName}>{selected.guestName ?? selected.guestToken.slice(0,8).toUpperCase()}</p>
                <p className={styles.chatMeta}>
                  {selected.id.slice(0,8).toUpperCase()} ·{" "}
                  <span className={`${styles.statusBadge} ${statusClass(selected.status, styles)}`}>{statusLabel(selected.status)}</span>
                  {selected.firstResponseAt && <span className={styles.responseTime}> · first reply {relTime(selected.firstResponseAt, locale)}</span>}
                </p>
                {selected.pageUrl && (
                  <p className={styles.chatPageUrl}>
                    <a href={selected.pageUrl} target="_blank" rel="noopener noreferrer">{selected.pageUrl.replace(/^https?:\/\/[^/]+/, "")}</a>
                  </p>
                )}
                {!!selected.checkoutProducts?.length && (
                  <div className={styles.chatCheckoutProducts}>
                    {selected.checkoutProducts.map((p) => (
                      <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer" title={p.title}>
                        {p.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.chatActions}>
                {selected.status !== "closed" ? (
                  <button className={styles.actionBtn} onClick={() => setStatus(selected.id, "closed")}>
                    <CheckCircle2 size={16} strokeWidth={1.75} />Close
                  </button>
                ) : (
                  <button className={styles.actionBtn} onClick={() => setStatus(selected.id, "open")}>
                    <RotateCcw size={16} strokeWidth={1.75} />Reopen
                  </button>
                )}
                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => setDeleteConfirmId(selected.id)}>
                  <Trash2 size={16} strokeWidth={1.75} />Delete
                </button>
              </div>
            </div>

            <div className={styles.messages}>
              {msgLoading && <p className={styles.loadingMsg}>Loading…</p>}
              {messages.map(msg => {
                const isFailed   = msg._status === "failed";
                const isAdminMsg = msg.senderType === "admin";
                const isSeenMsg  = msg.id === seenMsgId;
                const bubbleContent = msg.senderType === "system"
                  ? SYSTEM_MESSAGES[msg.content] ?? msg.content
                  : msg.content;

                return (
                  <div key={msg.id} className={styles.msgGroup}>
                    <div className={`${styles.bubble} ${isAdminMsg ? styles.bubbleAdmin : msg.senderType === "system" ? styles.bubbleSystem : styles.bubbleGuest} ${isFailed ? styles.bubbleFailed : ""}`}>
                      {msg.senderType !== "admin" && msg.senderType !== "system" && (
                        <span className={styles.bubbleSender}>{selected.guestName ?? "Guest"}</span>
                      )}
                      <p className={styles.bubbleText}>{bubbleContent}</p>
                      <div className={styles.bubbleMeta}>
                        <span className={styles.bubbleTime}>
                          {new Date(msg.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {isAdminMsg && msg._status === "sending" && <span className={styles.statusSending} title="Sending…">◷</span>}
                        {isAdminMsg && isFailed && (
                          <button className={styles.retryInline} onClick={() => msg._clientId && retryAdminMessage(msg._clientId)}>Retry</button>
                        )}
                      </div>
                    </div>
                    {isSeenMsg && <span className={styles.seenLabel}>Seen by guest</span>}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {selectedId && guestTyping[selectedId] && (
              <div className={styles.typingIndicator}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingLabel}>Guest is typing…</span>
              </div>
            )}

            {selected.status !== "closed" && selected.status !== "archived" ? (
              <div className={styles.inputRow}>
                <textarea
                  className={styles.input}
                  placeholder="Type a reply…"
                  value={input}
                  rows={2}
                  onChange={handleInputChange}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                />
                <button className={styles.sendBtn} onClick={sendMessage} disabled={!input.trim() || wsStatus !== "connected"}>
                  <Send size={16} strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <p className={styles.closedNotice}>
                {selected.status === "archived" ? "This conversation is archived." : "This conversation is closed."}
                {selected.status === "closed" && <button onClick={() => setStatus(selected.id, "open")} className={styles.reopenLink}>Reopen</button>}
              </p>
            )}
          </>
        )}
      </main>

      {/* ── Delete confirm modal ── */}
      {deleteConfirmId && (
        <div className={styles.modalOverlay} onClick={() => setDeleteConfirmId(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete conversation?</h3>
            <p className={styles.modalBody}>This will permanently delete the conversation and all its messages. This cannot be undone.</p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button className={styles.modalDelete} onClick={() => deleteConversation(deleteConfirmId)}>Delete permanently</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings modal ── */}
      {showSettings && (
        <div className={styles.modalOverlay} onClick={() => setShowSettings(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Notification Settings</h3>
            {settings && (
              <div className={styles.settingsForm}>
                <label className={styles.settingsRow}>
                  <span>Enable SMS notifications</span>
                  <input type="checkbox" checked={settings.smsEnabled} onChange={e => setSettings(s => s ? { ...s, smsEnabled: e.target.checked } : s)} />
                </label>
                <label className={styles.settingsRow}>
                  <span>Cooldown between SMS (minutes)</span>
                  <input type="number" min={1} max={1440} value={settings.smsCooldownMin} className={styles.settingsInput}
                    onChange={e => setSettings(s => s ? { ...s, smsCooldownMin: Number(e.target.value) } : s)} />
                </label>
                <label className={styles.settingsRow}>
                  <span>Auto-close after inactivity (hours)</span>
                  <input type="number" min={1} max={8760} value={settings.inactiveCloseHours} className={styles.settingsInput}
                    onChange={e => setSettings(s => s ? { ...s, inactiveCloseHours: Number(e.target.value) } : s)} />
                </label>
                <div className={styles.settingsPhones}>
                  <span className={styles.settingsLabel}>Notification phone numbers</span>
                  {settings.smsPhones.map(p => (
                    <div key={p} className={styles.phoneChip}>
                      {p}
                      <button onClick={() => setSettings(s => s ? { ...s, smsPhones: s.smsPhones.filter(x => x !== p) } : s)}><X size={14} strokeWidth={2} /></button>
                    </div>
                  ))}
                  <div className={styles.phoneAddRow}>
                    <input className={styles.settingsInput} placeholder="+1 555 123 4567" value={phoneDraft}
                      onChange={e => setPhoneDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addPhone(); }} />
                    <button className={styles.addPhoneBtn} onClick={addPhone}>Add</button>
                  </div>
                </div>
              </div>
            )}
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowSettings(false)}>Cancel</button>
              <button className={styles.modalDelete} style={{ background: "var(--color-secondary)" }} onClick={() => { saveSettings(); setShowSettings(false); }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
