"use client";

import { useEffect, useRef } from "react";
import "rrweb-player/dist/style.css";

interface RrwebPlayerInstance {
  addEventListener: (event: string, cb: (payload: { payload: number }) => void) => void;
  goto: (ms: number) => void;
}

export interface ReplayPlayerHandle {
  goto: (ms: number) => void;
}

export default function ReplayPlayer({ events, onTimeUpdate }: { events: unknown[]; onTimeUpdate?: (ms: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RrwebPlayerInstance | null>(null);

  useEffect(() => {
    if (!containerRef.current || events.length === 0) return;
    let cancelled = false;

    import("rrweb-player").then(({ default: RrwebPlayer }) => {
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = new (RrwebPlayer as any)({
        target: containerRef.current,
        props: { events, width: 880, height: 480, autoPlay: false },
      }) as RrwebPlayerInstance;
      player.addEventListener("ui-update-current-time", (e) => onTimeUpdate?.(e.payload));
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  return <div ref={containerRef} />;
}
