"use client";

import { useEffect, useState } from "react";
import styles from "./CategoryHero.module.css";

/**
 * Which treatment the copy needs to stay readable over the artwork.
 *
 * "dark" is the safe default — a soft dark gradient under white text, which
 * works over almost any photograph. "light" is for the pale, high-key pictures
 * a children's brand actually shoots: over those, a black slab looks like a
 * mistake, so the copy flips to charcoal on a frosted light wash instead.
 */
type Treatment = "dark" | "light";

/** Above this average luminance (0–1) the artwork is too bright to carry white
 *  text comfortably. Sits above mid-grey because white-on-mid-grey is still
 *  fine once the gradient is under it; only genuinely pale images flip. */
const BRIGHT_THRESHOLD = 0.62;

/** Small enough to be a rounding error on the page's weight (~3KB), large
 *  enough to average honestly. Requested through Next's optimizer, which serves
 *  it from this origin — the bucket sends no CORS headers, so a canvas reading
 *  the original directly would be tainted and throw. */
const PROBE_WIDTH = 64;

/** Remembered per URL so navigating back to a category does not re-measure. */
const treatmentCache = new Map<string, Treatment>();

/**
 * Averages the luminance of the corner the copy sits in, rather than the whole
 * picture: a banner can be dark overall and still put a white sky exactly where
 * the heading goes.
 */
async function measureTreatment(src: string): Promise<Treatment> {
  const cached = treatmentCache.get(src);
  if (cached) return cached;

  const probeUrl = `/_next/image?url=${encodeURIComponent(src)}&w=${PROBE_WIDTH}&q=75`;
  const img = new Image();
  img.crossOrigin = "anonymous";

  const ok = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = probeUrl;
  });
  if (!ok || !img.naturalWidth) return "dark";

  try {
    const canvas = document.createElement("canvas");
    const w = (canvas.width = PROBE_WIDTH);
    const h = (canvas.height = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * PROBE_WIDTH)));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "dark";
    ctx.drawImage(img, 0, 0, w, h);

    // The lower-left block the text occupies: left 60%, bottom 55%.
    const x0 = 0;
    const y0 = Math.floor(h * 0.45);
    const { data } = ctx.getImageData(x0, y0, Math.max(1, Math.floor(w * 0.6)), Math.max(1, h - y0));

    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Rec. 709 luma — matches how the eye weights the channels, so a bright
      // yellow reads as bright and a saturated blue does not.
      sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      count++;
    }
    const treatment: Treatment = count && sum / count > BRIGHT_THRESHOLD ? "light" : "dark";
    treatmentCache.set(src, treatment);
    return treatment;
  } catch {
    // A tainted canvas or a browser refusing getImageData: the dark gradient is
    // the safe answer, so the feature degrades instead of breaking.
    return "dark";
  }
}

/**
 * The category landing masthead: the banner is the visual, the copy sits inside
 * it at the lower left under only as much gradient as readability needs.
 *
 * The gradient is directional — it fades out well before the right edge — so
 * the subject of the photograph stays uncovered while the corner the text
 * occupies is conditioned for it.
 */
export default function CategoryHero({
  name,
  description,
  bannerUrl,
  parentName,
}: {
  name: string;
  description?: string | null;
  bannerUrl?: string | null;
  /** The branch this category sits in, shown as a small eyebrow above the name. */
  parentName?: string | null;
}) {
  const [treatment, setTreatment] = useState<Treatment>(() => (bannerUrl ? treatmentCache.get(bannerUrl) ?? "dark" : "dark"));

  useEffect(() => {
    if (!bannerUrl) return;
    let cancelled = false;
    measureTreatment(bannerUrl).then((t) => {
      if (!cancelled) setTreatment(t);
    });
    return () => {
      cancelled = true;
    };
  }, [bannerUrl]);

  // No artwork: the copy still needs a ground, so the block becomes a soft
  // brand-tinted band rather than a heading floating on white.
  const variant = !bannerUrl ? styles.heroPlain : treatment === "light" ? styles.heroLight : styles.heroDark;

  return (
    <header className={`${styles.hero} ${variant}`}>
      {bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bannerUrl} alt="" className={styles.image} />
      )}

      {bannerUrl && <span className={styles.scrim} aria-hidden="true" />}

      <div className={styles.copy}>
        {parentName && <span className={styles.eyebrow}>{parentName}</span>}
        <h1 className={styles.title}>{name}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
    </header>
  );
}
