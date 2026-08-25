import type { Locale } from "@/lib/i18n";
import { localized, type HomeSectionConfig } from "./sectionTypes";
import styles from "./Home.module.css";

/**
 * Long-form copy for the foot of the home page.
 *
 * A storefront home page is almost entirely product names and button labels —
 * there is nothing on it for a search engine to read. This block is the prose
 * that fixes that, so it is styled quieter and narrower than the rest of the
 * page: present for anyone who scrolls that far, never competing with the
 * merchandising above it.
 *
 * The body is HTML from the admin's rich-text editor. Same trust boundary as
 * blog post content — authored behind admin auth, rendered as written.
 */
export default function SeoText({
  config,
  locale,
  tinted = false,
}: {
  config: HomeSectionConfig;
  locale: Locale;
  tinted?: boolean;
}) {
  const heading = localized(config.heading, locale);
  const body = localized(config.body, locale);

  // An empty rich-text editor still serialises to "<p></p>" — that is not copy.
  const hasBody = body.replace(/<[^>]*>/g, "").trim().length > 0;
  if (!heading && !hasBody) return null;

  return (
    <section className={`${styles.section} ${tinted ? styles.sectionTinted : ""}`}>
      <div className={styles.container}>
        <div className={styles.seoText}>
          {heading && <h2 className={styles.seoTitle}>{heading}</h2>}
          {hasBody && <div className={styles.seoBody} dangerouslySetInnerHTML={{ __html: body }} />}
        </div>
      </div>
    </section>
  );
}
