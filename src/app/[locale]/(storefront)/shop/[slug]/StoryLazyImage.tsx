"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StoryGallery.module.css";

/**
 * Lazy-loaded image with a shimmer skeleton shell. The shell keeps its
 * aspect-ratio (set by the parent class) so the image never causes layout
 * shift while loading.
 */
export default function StoryLazyImage({ src, alt, eager = false }: { src: string; alt: string; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // Covers cached images whose `load` event fired before hydration.
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <span className={`${styles.imgShell} ${loaded ? styles.imgShellLoaded : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading={eager ? undefined : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={styles.img}
      />
    </span>
  );
}
