import type { HomeSectionConfig } from "./sectionTypes";
import styles from "./Home.module.css";

/**
 * A deliberate gap between chapters.
 *
 * Sounds like nothing, but the page's white / off-white banding is what gives it
 * structure, and until now that alternation was implicit — whatever parity the
 * sections above happened to leave behind. A separator is where an admin takes
 * that back: it inserts air, optionally draws a hairline, and (via `flipTint`,
 * handled by the page) decides where the next band starts.
 */
export default function SectionSeparator({ config }: { config: HomeSectionConfig }) {
  const tone = config.tone ?? "plain";
  const height = config.height ?? "md";

  const heightClass =
    height === "sm" ? styles.separatorSm : height === "lg" ? styles.separatorLg : styles.separatorMd;

  return (
    <div
      className={`${styles.separator} ${heightClass} ${tone === "tint" ? styles.sectionTinted : ""}`}
      role="presentation"
    >
      {tone === "line" && <span className={styles.separatorLine} />}
    </div>
  );
}
