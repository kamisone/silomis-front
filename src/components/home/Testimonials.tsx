import { Quote, Star } from "lucide-react";
import type { getTranslations, Locale } from "@/lib/i18n";
import { localized, type HomeSectionConfig } from "./sectionTypes";
import SectionHead from "./SectionHead";
import styles from "./Home.module.css";

/**
 * Hand-picked customer quotes, as a rail that scrolls sideways.
 *
 * A rail rather than a grid because social proof is browsed, not read: a
 * shopper skims two or three and moves on, and a grid of six would demand the
 * vertical space of a whole section for something nobody reads to the end.
 * The scrollbar is hidden and snap points do the work instead, so the rail
 * reads as a designed strip rather than a scrolling box — but it is still a
 * plain overflow container, so trackpad, wheel, touch, and keyboard all work
 * without a line of JavaScript.
 *
 * Nothing is invented when the admin has written nothing: an empty list hides
 * the section, the same way the FAQ block does. Fabricated praise is worse
 * than none.
 */
export default function Testimonials({
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
  const items = (config.testimonials ?? [])
    .map((item) => ({
      id: item.id,
      // Clamped rather than trusted: config is hand-edited JSON, and a stray
      // 7 would print seven stars.
      rating: item.rating ? Math.max(1, Math.min(5, Math.round(item.rating))) : null,
      quote: localized(item.quote, locale),
      name: (item.name ?? "").trim(),
      meta: localized(item.meta, locale),
    }))
    // The quote is the testimonial; a row without one is an unfinished draft.
    .filter((item) => item.quote);

  if (items.length === 0) return null;

  const title = localized(config.title, locale) || t.shop.homeTestimonialsTitle;

  return (
    <section className={`${styles.section} ${tinted ? styles.sectionTinted : ""}`}>
      <div className={styles.container}>
        <SectionHead title={title} />
      </div>

      {/* Outside the container so the rail bleeds to the viewport edge: a card
          clipped by the screen edge is what tells a shopper there is more to
          the right. The scroll padding puts the first card back in line with
          the heading above it. */}
      <ul className={styles.testimonialRail}>
        {items.map((item) => (
          <li key={item.id} className={styles.testimonialCard}>
            <Quote className={styles.testimonialMark} size={22} strokeWidth={2} aria-hidden="true" />

            {item.rating && (
              <div
                className={styles.testimonialStars}
                role="img"
                aria-label={`${item.rating} / 5`}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    size={15}
                    strokeWidth={1.5}
                    className={i < item.rating! ? styles.testimonialStarOn : styles.testimonialStarOff}
                    aria-hidden="true"
                  />
                ))}
              </div>
            )}

            {/* The admin's textarea keeps real newlines, same as the FAQ answer. */}
            <blockquote className={styles.testimonialQuote}>{item.quote}</blockquote>

            {(item.name || item.meta) && (
              <figcaption className={styles.testimonialWho}>
                {/* The initial stands in for a photo: the brand does not have
                    portraits of its customers, and a stock face beside a real
                    quote reads as a stock quote. */}
                {item.name && (
                  <span className={styles.testimonialAvatar} aria-hidden="true">
                    {item.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className={styles.testimonialWhoText}>
                  {item.name && <span className={styles.testimonialName}>{item.name}</span>}
                  {item.meta && <span className={styles.testimonialMeta}>{item.meta}</span>}
                </span>
              </figcaption>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
