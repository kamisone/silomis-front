import { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";

const MAX_BUFFERED_EVENTS = 50;
const MAX_BUFFERED_BYTES = 200_000;
const FLUSH_INTERVAL_MS = 5000;
const SCROLL_THROTTLE_MS = 300;
const SCROLL_MIN_DELTA_PCT = 5;

interface Marker {
  type: "click" | "scroll" | "navigation";
  timestampMs: number;
  label?: string | null;
  meta?: Record<string, unknown> | null;
}

interface ActiveRecording {
  sessionId: string;
  stopRrweb: () => void;
  cleanup: () => void;
}

// Module-level singleton — one recording per browser tab, deliberately not
// stopped on component unmount so it survives client-side navigation into checkout.
let activeRecording: ActiveRecording | null = null;

export async function startReplayRecording(productId: string): Promise<void> {
  if (activeRecording) return; // already recording this tab

  const res = await fetch("/next-api/public/shop/replay/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageUrl: window.location.href,
      pageTitle: document.title,
    }),
  }).catch(() => null);

  const data = res?.ok ? await res.json().catch(() => null) : null;
  const sessionId = data?.sessionId as string | undefined;
  if (!sessionId) return; // gated out server-side (excluded IP/bot/not a test product) — don't record

  // Marker timestamps are elapsed ms since recording start, not an absolute epoch —
  // the backend column is a 32-bit int, and Date.now() overflows it.
  const startedAtPerf = performance.now();
  const elapsedMs = () => Math.round(performance.now() - startedAtPerf);

  let eventBuffer: eventWithTime[] = [];
  let markerBuffer: Marker[] = [];
  let lastScrollPct = 0;
  let lastScrollAt = 0;

  const flush = (useBeacon = false) => {
    if (eventBuffer.length === 0 && markerBuffer.length === 0) return;
    const payload = JSON.stringify({ events: eventBuffer, markers: markerBuffer });
    eventBuffer = [];
    markerBuffer = [];

    const url = `/next-api/public/shop/replay/sessions/${sessionId}/events`;
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } else {
      // keepalive must only be set on the unload-time beacon fallback: Chromium caps
      // keepalive request bodies at 64KB, and rrweb's initial full-snapshot event alone
      // can exceed that, so setting it unconditionally here silently fails every flush.
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: useBeacon }).catch(() => {});
    }
  };

  const flushTimer = window.setInterval(() => flush(), FLUSH_INTERVAL_MS);

  const stopRrweb = record({
    emit: (event) => {
      eventBuffer.push(event);
      if (eventBuffer.length >= MAX_BUFFERED_EVENTS || JSON.stringify(eventBuffer).length >= MAX_BUFFERED_BYTES) flush();
    },
    maskAllInputs: true,
    maskInputOptions: { password: true, email: true, tel: true },
  }) as unknown as () => void;

  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    markerBuffer.push({ type: "click", timestampMs: elapsedMs(), label: target?.tagName?.toLowerCase() ?? null });
  };

  const onScroll = () => {
    const now = performance.now();
    if (now - lastScrollAt < SCROLL_THROTTLE_MS) return;
    const doc = document.documentElement;
    const pct = doc.scrollHeight > doc.clientHeight ? Math.round((doc.scrollTop / (doc.scrollHeight - doc.clientHeight)) * 100) : 0;
    if (Math.abs(pct - lastScrollPct) < SCROLL_MIN_DELTA_PCT) return;
    lastScrollAt = now;
    lastScrollPct = pct;
    markerBuffer.push({ type: "scroll", timestampMs: elapsedMs(), meta: { pct } });
  };

  const originalPushState = history.pushState.bind(history);
  history.pushState = ((...args: Parameters<typeof history.pushState>) => {
    markerBuffer.push({ type: "navigation", timestampMs: elapsedMs(), label: window.location.pathname });
    return originalPushState(...args);
  }) as typeof history.pushState;

  document.addEventListener("click", onClick, { capture: true });
  document.addEventListener("scroll", onScroll, { passive: true });

  const onHide = () => {
    if (document.visibilityState === "hidden") {
      flush(true);
      fetch(`/next-api/public/shop/replay/sessions/${sessionId}/end`, { method: "POST", keepalive: true }).catch(() => {});
    }
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onHide);

  activeRecording = {
    sessionId,
    stopRrweb,
    cleanup: () => {
      window.clearInterval(flushTimer);
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      history.pushState = originalPushState;
    },
  };
}
