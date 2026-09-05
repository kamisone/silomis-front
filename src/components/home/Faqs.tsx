import { ChevronDown } from "lucide-react";
import type { getTranslations, Locale } from "@/lib/i18n";
import { localized, type HomeSectionConfig } from "./sectionTypes";
import SectionHead from "./SectionHead";
import styles from "./Home.module.css";

/**
 * The admin-authored FAQ block: a short list of question/answer pairs as an
 * expandable accordion. Plain `<details>`/`<summary>` rather than a client
 * component with its own open-state — an accordion is exactly what that
 * element already is, for free, with or without JS, and independent items
 * (no `name` grouping) let a shopper compare two answers open at once.
 *
 * No built-in fallback content the way `TrustBar` has a default four — there
 * is no generic "frequently asked question" to show a merchant who hasn't
 * written any, so an empty list hides the whole section instead.
 */
export default function Faqs({
  config,
  locale,
  t,
  tinted = false,
}: {
  config: HomeSectionConfig;
  locale: Locale;
  t: ReturnType<typeof getTranslations>;
  tinted?: boolean;
}) {
  const items = (config.faqItems ?? [])
    .map((item) => ({
      id: item.id,
      question: localized(item.question, locale),
      answer: localized(item.answer, locale),
    }))
    // A question with no answer (or the reverse) is an unfinished draft, not
    // a row worth showing — skip it rather than printing half a card.
    .filter((item) => item.question && item.answer);

  if (items.length === 0) return null;

  const title = localized(config.title, locale) || t.shop.homeFaqsTitle;

  return (
    <section className={`${styles.section} ${tinted ? styles.sectionTinted : ""}`}>
      <div className={styles.container}>
        <SectionHead title={title} />
        <div className={styles.faqList}>
          {items.map((item) => (
            <details key={item.id} className={styles.faqItem}>
              <summary className={styles.faqToggle}>
                <span className={styles.faqQuestion}>{item.question}</span>
                <span className={styles.faqChevronBadge} aria-hidden="true">
                  <ChevronDown size={16} strokeWidth={2.25} />
                </span>
              </summary>
              {/* The admin's textarea keeps real line breaks — pre-line is what
                  makes a second paragraph in an answer read as one instead of
                  running the whole thing together. */}
              <p className={styles.faqAnswer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
