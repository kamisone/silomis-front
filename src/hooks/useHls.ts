"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

interface UseHlsOptions {
  /** Delay attaching (and downloading) until true — e.g. slide first shown. Default true. */
  enabled?: boolean;
  /** Called once the stream is ready to play (manifest parsed / native src set). */
  onReady?: () => void;
}

/**
 * Attaches an HLS stream to a <video> element: native playback on Safari/iOS,
 * lazy-loaded hls.js elsewhere. Returns `true` when HLS playback is not
 * possible (unsupported or fatal error) — the caller should then fall back to
 * a progressive source, typically by rendering `src`/<source> on the element.
 */
export default function useHls(
  videoRef: RefObject<HTMLVideoElement | null>,
  hlsSrc: string | null | undefined,
  { enabled = true, onReady }: UseHlsOptions = {},
): boolean {
  const [failed, setFailed] = useState(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsSrc || failed || !enabled) return;

    // Safari (and iOS): native HLS support
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      if (video.currentSrc !== hlsSrc) video.src = hlsSrc;
      onReadyRef.current?.();
      return;
    }

    let hls: import("hls.js").default | null = null;
    let cancelled = false;
    (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled || !videoRef.current) return;
      if (!Hls.isSupported()) {
        setFailed(true);
        return;
      }
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          hls?.destroy();
          setFailed(true);
        }
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => onReadyRef.current?.());
      hls.loadSource(hlsSrc);
      hls.attachMedia(videoRef.current);
    })();

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [videoRef, hlsSrc, failed, enabled]);

  return failed;
}
