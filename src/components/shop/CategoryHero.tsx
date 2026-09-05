import styles from "./CategoryHero.module.css";

/**
 * The category landing masthead: the banner is the visual, the copy sits
 * inside it at the lower left, over the same long white fade the home page
 * hero uses at its own bottom edge — see CategoryHero.module.css for why
 * that curve reads as seamless. Because the copy sits where the fade has
 * already gone nearly opaque, the text is dark rather than white: there is
 * no photograph left showing through by that point to need a light color or
 * a scrim to sit on.
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
  // No artwork: the copy still needs a ground, so the block becomes a soft
  // brand-tinted band rather than a heading floating on white.
  const variant = bannerUrl ? styles.heroPhoto : styles.heroPlain;

  return (
    <header className={`${styles.hero} ${variant}`}>
      {bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bannerUrl} alt="" className={styles.image} />
      )}

      <div className={styles.copy}>
        {parentName && <span className={styles.eyebrow}>{parentName}</span>}
        <h1 className={styles.title}>{name}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
    </header>
  );
}
