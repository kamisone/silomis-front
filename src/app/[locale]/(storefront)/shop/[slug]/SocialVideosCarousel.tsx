"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import useHls from "@/hooks/useHls";
import styles from "./SocialVideosCarousel.module.css";

export interface SocialVideoItem {
  id: string;
  /** Progressive mp4 URL (fallback / non-HLS browsers) */
  url: string;
  /** HLS master playlist URL — preferred when playable */
  hlsUrl?: string | null;
  posterUrl?: string | null;
  title?: string | null;
  durationSeconds?: number | null;
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/* ── Single reel card: autoplays muted while ≥60% visible, pauses otherwise ── */
function ReelCard({ video, suspended, onOpen }: { video: SocialVideoItem; suspended: boolean; onOpen: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);

  const shouldPlay = visible && !suspended;
  const shouldPlayRef = useRef(shouldPlay);
  useEffect(() => {
    shouldPlayRef.current = shouldPlay;
  }, [shouldPlay]);

  // Track visibility — drives autoplay/pause and defers any loading offscreen
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.intersectionRatio >= 0.6);
        if (entry.isIntersecting) setStarted(true);
      },
      { threshold: [0, 0.6] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hlsFailed = useHls(videoRef, video.hlsUrl, {
    enabled: started,
    onReady: () => {
      if (shouldPlayRef.current) videoRef.current?.play().catch(() => {});
    },
  });
  const useHlsPlayback = !!video.hlsUrl && !hlsFailed;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (shouldPlay) el.play().catch(() => {});
    else el.pause();
  }, [shouldPlay]);

  return (
    <div
      ref={cardRef}
      className={styles.card}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={video.title?.trim() || "Play video"}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <video
        ref={videoRef}
        className={styles.cardVideo}
        src={started && !useHlsPlayback ? video.url : undefined}
        poster={video.posterUrl ?? undefined}
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div className={styles.cardShade} aria-hidden="true" />
      {!playing && (
        <span className={styles.cardPlayBadge} aria-hidden="true">
          <Play size={18} fill="currentColor" />
        </span>
      )}
      {video.durationSeconds != null && (
        <span className={styles.cardDuration}>{formatDuration(video.durationSeconds)}</span>
      )}
      {video.title?.trim() && <span className={styles.cardBadge}>{video.title}</span>}
    </div>
  );
}

/* ── Fullscreen viewer: dark backdrop, tap to play/pause, swipe/arrow-key nav,
   M mutes, Esc closes. Bottom chrome mirrors a native reels player. ── */
function ReelsViewer({ videos, initialIndex, onClose }: { videos: SocialVideoItem[]; initialIndex: number; onClose: () => void }) {
  const [current, setCurrent] = useState(initialIndex);
  const [playing, setPlaying] = useState(false);
  // Opened by an explicit click (user gesture), so sound-on playback is allowed
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef<number | null>(null);
  const active = videos[current];
  const hasMany = videos.length > 1;

  const prev = useCallback(() => setCurrent((c) => (c - 1 + videos.length) % videos.length), [videos.length]);
  const next = useCallback(() => setCurrent((c) => (c + 1) % videos.length), [videos.length]);
  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);
  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }, []);

  /** Plays with sound; if the browser blocks audible autoplay, falls back to muted. */
  const attemptPlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.play().catch((err: unknown) => {
      if ((err as DOMException)?.name === "NotAllowedError" && !el.muted) {
        el.muted = true;
        setMuted(true);
        el.play().catch(() => {});
      }
    });
  }, []);

  const hlsFailed = useHls(videoRef, active?.hlsUrl, { onReady: attemptPlay });
  const useHlsPlayback = !!active?.hlsUrl && !hlsFailed;

  // Keep the element's muted state across slide remounts; autoplay needs it set
  // before play() — React's `muted` prop isn't applied as a DOM property reliably.
  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
      if (el) el.muted = muted;
    },
    [muted],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === "m") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next, togglePlay, toggleMute]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setProgress(0), 0);
    return () => clearTimeout(t);
  }, [current]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  if (!active) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.stage} onClick={(e) => e.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div key={active.id} className={styles.frame}>
          <video
            ref={setVideoRef}
            className={styles.video}
            src={useHlsPlayback ? undefined : active.url}
            poster={active.posterUrl ?? undefined}
            autoPlay
            loop
            playsInline
            disablePictureInPicture
            onLoadedMetadata={attemptPlay}
            onClick={togglePlay}
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => {
              const el = e.currentTarget;
              if (el.duration > 0) setProgress(el.currentTime / el.duration);
            }}
          />
          {active.title?.trim() && <span className={styles.frameBadge}>{active.title}</span>}
          {!playing && (
            <button type="button" className={styles.centerPlay} onClick={togglePlay} aria-label="Play video">
              <Play size={26} fill="currentColor" />
            </button>
          )}

          <div className={styles.bottomChrome}>
            <div className={styles.progressTrack} aria-hidden="true">
              <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
            </div>
            <div className={styles.controlsRow}>
              <button type="button" className={styles.ctrlBtn} onClick={togglePlay} aria-label={playing ? "Pause video" : "Play video"}>
                {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
              </button>
              <button type="button" className={styles.ctrlBtn} onClick={toggleMute} aria-label={muted ? "Unmute video" : "Mute video"}>
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              {hasMany && (
                <span className={styles.counter} aria-live="polite">
                  {current + 1} / {videos.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <button type="button" autoFocus className={styles.close} onClick={onClose} aria-label="Close viewer">
        <X size={18} />
      </button>

      {hasMany && (
        <>
          <button
            type="button"
            className={`${styles.nav} ${styles.navPrev}`}
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Previous video"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            className={`${styles.nav} ${styles.navNext}`}
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next video"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}

/**
 * "Social Videos" reels section: horizontally snap-scrolling video cards that
 * autoplay muted while in view. Clicking a card opens a fullscreen viewer.
 */
export default function SocialVideosCarousel({ videos, title, ariaLabel }: { videos: SocialVideoItem[]; title: string; ariaLabel: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [fits, setFits] = useState(() => videos.length <= 2);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    setFits(el.scrollWidth <= el.clientWidth + 1);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  function scrollByCard(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  if (!videos.length) return null;

  return (
    <section className={styles.section} aria-label={ariaLabel}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {!fits && (
          <div className={styles.arrows}>
            <button type="button" className={styles.arrowBtn} onClick={() => scrollByCard(-1)} disabled={!canPrev} aria-label="Scroll videos left">
              <ChevronLeft size={17} />
            </button>
            <button type="button" className={styles.arrowBtn} onClick={() => scrollByCard(1)} disabled={!canNext} aria-label="Scroll videos right">
              <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>

      <div ref={trackRef} className={`${styles.track} ${fits ? styles.trackCentered : ""}`}>
        {videos.map((video, i) => (
          <ReelCard key={video.id} video={video} suspended={viewerIndex !== null} onOpen={() => setViewerIndex(i)} />
        ))}
      </div>

      {viewerIndex !== null && <ReelsViewer videos={videos} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />}
    </section>
  );
}
