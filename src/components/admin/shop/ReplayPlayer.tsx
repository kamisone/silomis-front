"use client";

import { useEffect, useRef, useState } from "react";
import "rrweb-player/dist/style.css";

interface RrwebPlayerInstance {
  addEventListener: (event: string, cb: (payload: { payload: number }) => void) => void;
  goto: (ms: number) => void;
  triggerResize: () => void;
  $set: (props: Record<string, unknown>) => void;
  $destroy: () => void;
}

/** The 880x480 the player used to be pinned to — the shape, not the size. */
const ASPECT = 480 / 880;
/** Below this the controller bar wraps and the frame is unusable anyway. */
const MIN_WIDTH = 280;
/** Leaves room for the modal header and the player's own controller strip. */
const MAX_HEIGHT = 560;

function frameSize(width: number) {
  return { width, height: Math.min(MAX_HEIGHT, Math.round(width * ASPECT)) };
}

export default function ReplayPlayer({ events, onTimeUpdate }: { events: unknown[]; onTimeUpdate?: (ms: number) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RrwebPlayerInstance | null>(null);

  /**
   * The player is a fixed-size widget: it takes a pixel width and does not
   * respond to its container. Hardcoded at 880 it overflowed its flex column
   * in the modal and — because the scroll container is the modal body — shoved
   * the whole layout sideways, cutting off everything to the left. So the
   * column is measured and the width handed to the player.
   *
   * Mirrored into a ref because the build effect must not list `width` in its
   * dependencies (that would tear the player down and restart playback on
   * every drag of the window) while still reading the current value.
   */
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const next = Math.max(MIN_WIDTH, Math.floor(el.clientWidth));
      widthRef.current = next;
      setWidth(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // `ready` rather than `width`: it flips false -> true exactly once, so the
  // player is built as soon as a measurement exists and never rebuilt after.
  // Without it the first measurement lands after this effect has already run
  // and returned early, and the player is never created at all.
  const ready = width > 0;

  useEffect(() => {
    if (!hostRef.current || events.length === 0 || !ready) return;
    let cancelled = false;

    import("rrweb-player").then(({ default: RrwebPlayer }) => {
      if (cancelled || !hostRef.current) return;
      hostRef.current.innerHTML = "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = new (RrwebPlayer as any)({
        target: hostRef.current,
        props: { events, ...frameSize(widthRef.current), autoPlay: false },
      }) as RrwebPlayerInstance;
      player.addEventListener("ui-update-current-time", (e) => onTimeUpdate?.(e.payload));
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      playerRef.current?.$destroy?.();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, ready]);

  // Resize in place, so the recording keeps playing from where it was.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || width === 0) return;
    player.$set(frameSize(width));
    player.triggerResize();
  }, [width]);

  // The wrapper is what gets measured, so it must be free to be as narrow as
  // its column; the host inside holds the fixed-size widget.
  return (
    <div ref={wrapRef} style={{ width: "100%", minWidth: 0 }}>
      <div ref={hostRef} />
    </div>
  );
}
