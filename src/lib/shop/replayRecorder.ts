import { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";

/**
 * Session-replay recorder (rrweb) for test-product landing pages only — see
 * ReplayRecorderMount.tsx for the gating (test product ∧ analytics consent).
 * Batches events client-side and posts them through the /next-api proxy.
 * Never throws into the host page: every failure mode here is "stop recording
 * quietly", not a broken product page.
 */

const MAX_BUFFERED_EVENTS = 50;
const MAX_BUFFERED_BYTES = 200_000; // soft cap, well under the backend's hard per-batch cap
const FLUSH_INTERVAL_MS = 5000;
const SCROLL_THROTTLE_MS = 300;
const SCROLL_MIN_DELTA_PCT = 5;

interface Marker {
  // Mirrors the backend's marker enum (replay.dto.ts) exactly — an unknown
  // type fails zod validation and drops the whole batch, markers and events.
  type: "session_start" | "session_end" | "click" | "scroll" | "navigation";
  timestampMs: number;
  label?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface ReplayRecordingHandle {
  /** Flushes what's buffered, ends the session and tears everything down. Safe to call more than once. */
  stop: () => void;
}

function getCartToken(): string | null {
  try {
    return localStorage.getItem("shop_cart_token");
  } catch {
    return null;
  }
}

/** Best-effort short CSS-like path for a click target — for the admin event list, not for replaying. */
function describeTarget(el: Element | null): string {
  if (!el) return "";
  const parts: string[] = [];
  let node: Element | null = el;
  for (let depth = 0; node && depth < 3; depth++) {
    let part = node.tagName.toLowerCase();
    if (node.id) part = `#${node.id}`;
    else if (typeof node.className === "string") {
      const cls = node.className.trim().split(/\s+/)[0];
      if (cls) part = `.${cls}`;
    }
    parts.unshift(part);
    node = node.parentElement;
  }
  return parts.join(" > ");
}

function textLabel(el: Element | null): string | null {
  const text = el?.textContent?.trim();
  return text ? text.slice(0, 80) : null;
}

// Module-level singleton — one recording per browser tab, deliberately not
// stopped on component unmount so it survives the client-side navigation from
// the product page into checkout (rrweb's observers and the listeners below
// are attached to `document`/`window`, not to the mounting component).
let activeRecording: ReplayRecordingHandle | null = null;
// Set synchronously, before the session-start round trip, so two mounts racing
// in the same tick can't each open a session — `activeRecording` alone is only
// assigned after the await and would let both through.
let starting = false;

export async function startReplayRecording(productId: string): Promise<ReplayRecordingHandle | null> {
  if (activeRecording) return activeRecording;
  if (starting) return null;
  starting = true;

  try {
    const res = await fetch("/next-api/public/shop/replay/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        cartToken: getCartToken(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        pageUrl: window.location.href,
        pageTitle: document.title,
      }),
    }).catch(() => null);

    const data = res?.ok ? await res.json().catch(() => null) : null;
    const sessionId = data?.sessionId as string | undefined;
    if (!sessionId) return null; // gated out server-side (excluded IP/bot/not a test product) — don't record

    // Marker timestamps are elapsed ms since recording start, not an absolute epoch —
    // the backend column is a 32-bit int, and Date.now() overflows it.
    const startedAtPerf = performance.now();
    const elapsedMs = () => Math.round(performance.now() - startedAtPerf);

    let eventBuffer: eventWithTime[] = [];
    // Seeded so the admin timeline opens on an explicit start marker rather
    // than on whatever the visitor happened to do first.
    let markerBuffer: Marker[] = [{ type: "session_start", timestampMs: 0 }];
    let stopped = false;
    let lastScrollPct = -1;
    let lastScrollAt = 0;

    // Cheap estimate — avoids JSON.stringify on every single event push.
    const bufferedBytes = () => eventBuffer.length * 400 + markerBuffer.length * 120;

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
        if (eventBuffer.length >= MAX_BUFFERED_EVENTS || bufferedBytes() >= MAX_BUFFERED_BYTES) flush();
      },
      // ── Privacy: never capture sensitive form data ──
      // Every input's value is masked; the sensitive input types are masked
      // with a fixed-length placeholder rather than the real character count,
      // since the length itself leaks (a password's strength, an email's domain).
      maskAllInputs: true,
      maskInputOptions: { password: true, email: true, tel: true },
      maskTextFn: (text, el) =>
        el?.closest?.('input[type="password"], input[type="email"], input[type="tel"], [data-sensitive]')
          ? "*".repeat(Math.min(text.length, 8))
          : text,
      // Explicit opt-out beyond input masking: any element (or ancestor)
      // carrying either class is fully excluded from the recording
      // (blockClass) or has its text redacted (maskTextClass) — see the note
      // at the bottom of this file.
      blockClass: "rr-block",
      maskTextClass: "rr-mask",
      sampling: { scroll: SCROLL_THROTTLE_MS, input: "last" },
    }) as unknown as (() => void) | undefined;

    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      markerBuffer.push({
        type: "click",
        timestampMs: elapsedMs(),
        label: textLabel(target) ?? describeTarget(target),
        meta: { x: e.clientX, y: e.clientY, selector: describeTarget(target) },
      });
    };

    const onScroll = () => {
      const now = performance.now();
      if (now - lastScrollAt < SCROLL_THROTTLE_MS) return;
      const doc = document.documentElement;
      const pct = doc.scrollHeight > doc.clientHeight ? Math.round((doc.scrollTop / (doc.scrollHeight - doc.clientHeight)) * 100) : 0;
      // Only record meaningful movement, not every pixel — keeps the timeline's
      // scroll markers readable instead of a dense smear.
      if (Math.abs(pct - lastScrollPct) < SCROLL_MIN_DELTA_PCT) return;
      lastScrollAt = now;
      lastScrollPct = pct;
      // Key must stay `pct`: ReplayTrackingService.ingestBatch reads meta.pct
      // to maintain the session's maxScrollPct.
      markerBuffer.push({ type: "scroll", timestampMs: elapsedMs(), meta: { pct } });
    };

    // Read location *after* the navigation has happened, so the marker names
    // the page being entered rather than the one being left.
    const onNavigate = () => {
      markerBuffer.push({
        type: "navigation",
        timestampMs: elapsedMs(),
        label: window.location.pathname,
        meta: { path: window.location.pathname },
      });
    };

    // SPA route changes never fire popstate on their own (App Router calls
    // history.pushState directly) — wrap it so a client-side navigation still
    // produces a marker; restored on stop().
    const originalPushState = history.pushState.bind(history);
    history.pushState = ((...args: Parameters<typeof history.pushState>) => {
      const result = originalPushState(...args);
      onNavigate();
      return result;
    }) as typeof history.pushState;

    document.addEventListener("click", onClick, { capture: true, passive: true });
    document.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onNavigate);

    // Ending the session server-side is terminal — ingestBatch drops every
    // later batch for a non-active session — so tearing the recorder down at
    // the same moment is what keeps rrweb and the flush timer from running on
    // for the rest of the tab's life, posting batches nothing will store.
    const onHide = () => {
      if (document.visibilityState === "hidden") stop();
    };
    const onPageHide = () => stop();

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    function stop(): void {
      if (stopped) return;
      stopped = true;
      if (activeRecording === handle) activeRecording = null;

      window.clearInterval(flushTimer);
      document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
      document.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onNavigate);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      history.pushState = originalPushState;
      stopRrweb?.();

      flush(true);
      // The closing marker rides on /end rather than a final flush: the
      // backend writes it before flipping the session to `ended`, and
      // ingestBatch refuses every batch after that point.
      const endUrl = `/next-api/public/shop/replay/sessions/${sessionId}/end`;
      const endBody = JSON.stringify({ markers: [{ type: "session_end", timestampMs: elapsedMs() }] });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endUrl, new Blob([endBody], { type: "application/json" }));
      } else {
        fetch(endUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: endBody, keepalive: true }).catch(() => {});
      }
    }

    const handle: ReplayRecordingHandle = { stop };
    activeRecording = handle;
    return handle;
  } finally {
    starting = false;
  }
}

// ── Marking additional elements as private ──
// Any DOM element can be excluded from a replay recording without touching
// this file: add class `rr-block` to fully block it (rendered as an empty
// placeholder box in the replay — for embedded iframes, payment widgets,
// etc.), or `rr-mask` to keep its layout but redact its text content.
// `data-sensitive` on an ancestor also masks any input inside it, same as the
// built-in password/email/tel fields.
