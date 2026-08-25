import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import { localized, type HomeSectionConfig } from "./sectionTypes";
import styles from "./Home.module.css";

/**
 * A title with nothing under it.
 *
 * The rails and tile grids each carry their own heading, which is fine when the
 * page is a list of them — but it leaves no way to say "everything below here is
 * one idea". This block is that: a chapter title the admin drops above a group
 * of sections, so the page reads as named parts instead of one long stack.
 *
 * It paints its own band rather than joining the automatic tint alternation —
 * see `tinted` in sectionTypes for why a heading has to match the section it
 * introduces rather than taking its own turn.
 */
export default function SectionHeading({
  config,
  locale,
}: {
  config: HomeSectionConfig;
  locale: Locale;
}) {
  const eyebrow = localized(config.eyebrow, locale);
  const heading = localized(config.heading, locale);
  const subtitle = localized(config.subtitle, locale);

  // Nothing typed in any locale — an empty band is worse than no band.
  if (!eyebrow && !heading && !subtitle) return null;

  const centered = config.align === "center";

  return (
    <section
      className={`${styles.chapter} ${config.tinted ? styles.sectionTinted : ""} ${centered ? styles.chapterCentered : ""}`}
    >
      <div className={styles.container}>
        {eyebrow && <p className={styles.chapterEyebrow}>{eyebrow}</p>}
        {heading && (
          <h2 className={styles.chapterTitle}>
            {config.iconImageUrl && (
              <Image
                src={config.iconImageUrl}
                alt=""
                width={44}
                height={44}
                className={styles.chapterIcon}
                aria-hidden="true"
              />
            )}
            {heading}
          </h2>
        )}
        {subtitle && <p className={styles.chapterSubtitle}>{subtitle}</p>}
      </div>
    </section>
  );
}
