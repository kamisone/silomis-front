"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Maximize, Volume2, VolumeX } from "lucide-react";
import useHls from "@/hooks/useHls";
import styles from "./ProductGallery.module.css";

interface Props {
  src: string;
  /** HLS master playlist URL — preferred over `src` when the browser can play it. */
  hlsSrc?: string | null;
  poster?: string | null;
  /** True when this is the slide currently shown — drives autoplay/pause. */
  active: boolean;
  className: string;
  /** Show the fullscreen toggle (lightbox only). */
  allowFullscreen?: boolean;
}

/**
 * Custom-chrome video player for the gallery — no native browser controls,
 * so it reads as part of the product gallery rather than an embedded player.
 * Autoplays muted + looped when it becomes the active slide.
 *
 * When `hlsSrc` is set: Safari plays it natively; other browsers get hls.js
 * (lazy-loaded, attached only once the slide has been active — mirrors the
 * `preload="none"` behaviour of the mp4 path). Any fatal HLS error falls back
 * to the progressive `src`.
 */
export default function GalleryVideo({ src, hlsSrc, poster, active, className, allowFullscreen }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeRef = useRef(active);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  // Don't start fetching HLS data until the slide is first shown
  const [loadStarted, setLoadStarted] = useState(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setLoadStarted(true), 0);
    return () => clearTimeout(t);
  }, [active]);

  const hlsFailed = useHls(videoRef, hlsSrc, {
    enabled: loadStarted,
    onReady: () => {
      if (activeRef.current) videoRef.current?.play().catch(() => {});
    },
  });
  const useHlsPlayback = !!hlsSrc && !hlsFailed;

  // `muted` isn't a settable JSX prop in React's video typings — set it imperatively
  // on mount so the element starts muted (required for autoplay to be allowed).
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) el.muted = true;
  }, []);

  // Autoplay (muted) when this slide becomes active; pause + rewind otherwise.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.muted = true;
      const t = setTimeout(() => setMuted(true), 0);
      video.play().catch(() => setPlaying(false));
      return () => clearTimeout(t);
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [active]);

  const togglePlay = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const toggleMute = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else video.requestFullscreen?.();
  }, []);

  return (
    <div className={styles.videoWrap} onClick={togglePlay}>
      <video
        ref={setVideoRef}
        src={useHlsPlayback ? undefined : src}
        poster={poster ?? undefined}
        className={className}
        playsInline
        loop
        preload={active ? "auto" : "none"}
        disablePictureInPicture
        controlsList="nodownload noremoteplayback noplaybackrate"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {!playing && (
        <div className={styles.videoPlayOverlay} aria-hidden="true">
          <span><Play size={22} fill="#fff" /></span>
        </div>
      )}

      <div className={styles.videoControls}>
        <button
          type="button"
          onClick={togglePlay}
          className={styles.videoCtrlBtn}
          aria-label={playing ? "Pause video" : "Play video"}
        >
          {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          className={styles.videoCtrlBtn}
          aria-label={muted ? "Unmute video" : "Mute video"}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        {allowFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            className={styles.videoCtrlBtn}
            aria-label="Fullscreen"
          >
            <Maximize size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
