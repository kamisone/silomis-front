import styles from "./HeroSlides.module.css";

export interface SlideShape {
  imageUrl: string | null;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryHref: string | null;
}

/**
 * A miniature of the slide as the storefront will actually draw it.
 *
 * Not a wireframe: here the content *is* what's being configured, so the
 * preview mirrors the real hero — the same gradient, the same scrim over a
 * photo, the same copy card pinned to the right — at a size where the admin can
 * judge whether a headline fits the card and whether the picture still reads
 * around it. It updates as they type, before anything is saved.
 */
export default function SlidePreview({ slide }: { slide: SlideShape }) {
  const hasImage = !!slide.imageUrl;
  // A button only renders on the storefront when both its label and link are
  // set, so the preview holds to the same rule rather than flattering the draft.
  const primary = slide.ctaLabel?.trim() && slide.ctaHref?.trim() ? slide.ctaLabel.trim() : null;
  const secondary = slide.ctaSecondaryLabel?.trim() && slide.ctaSecondaryHref?.trim() ? slide.ctaSecondaryLabel.trim() : null;

  return (
    <div className={`${styles.preview} ${hasImage ? styles.previewImage : styles.previewGradient}`}>
      {hasImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.imageUrl ?? ""} alt="" className={styles.previewImg} />
          <span className={styles.previewScrim} />
        </>
      )}
      <div className={styles.previewInner}>
        {slide.eyebrow?.trim() && <span className={styles.previewEyebrow}>{slide.eyebrow.trim()}</span>}
        <span className={styles.previewTitle}>{slide.title.trim() || "Untitled slide"}</span>
        {slide.subtitle?.trim() && <span className={styles.previewSubtitle}>{slide.subtitle.trim()}</span>}
        {(primary || secondary) && (
          <span className={styles.previewActions}>
            {primary && <span className={styles.previewCta}>{primary}</span>}
            {secondary && <span className={styles.previewCtaSecondary}>{secondary}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
