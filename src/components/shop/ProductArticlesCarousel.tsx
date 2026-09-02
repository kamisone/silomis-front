"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCarousel } from "./useCarousel";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./ProductArticlesCarousel.module.css";

export interface ProductArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  readingTimeMinutes: number;
  publishedAt: string | null;
  categories: { id: string; name: string; color: string | null }[];
}

/** Must track `.slide` in the stylesheet, or next/image fetches the wrong size. */
const IMAGE_SIZES = "(max-width: 560px) 82vw, (max-width: 900px) 56vw, (max-width: 1200px) 40vw, 31vw";

/**
 * The articles attached to a product, as a horizontal carousel.
 *
 * Same interaction as the related-products carousel directly above it — swipe
 * on touch, drag or arrows with a mouse, dots for position — because two
 * carousels on one page that behave differently is worse than either
 * behaviour on its own. `useCarousel` is where that behaviour lives; only the
 * card markup differs.
 */
export default function ProductArticlesCarousel({
  items,
  locale,
  title,
}: {
  items: ProductArticle[];
  locale: Locale;
  title: string;
}) {
  const t = getTranslations(locale);
  const carousel = useCarousel({ count: items.length, draggingClass: styles.dragging });

  if (!items.length) return null;

  return (
    <section className={styles.section} aria-labelledby="product-articles">
      <div className={styles.inner}>
        <h2 id="product-articles" className={styles.title}>
          {title}
        </h2>

        <div className={styles.viewport}>
          <div
            {...carousel.trackProps}
            className={styles.track}
            role="group"
            aria-roledescription="carousel"
            aria-label={title}
            tabIndex={0}
          >
            {items.map((article, i) => (
              <article key={article.id} ref={carousel.setSlideRef(i)} className={styles.slide}>
                <Link href={`/${locale}/blog/${article.slug}`} className={styles.card}>
                  <div className={styles.media}>
                    {article.featuredImageUrl ? (
                      <Image
                        src={article.featuredImageUrl}
                        alt={article.featuredImageAlt ?? ""}
                        fill
                        loading="lazy"
                        sizes={IMAGE_SIZES}
                        className={styles.image}
                      />
                    ) : (
                      <div className={styles.imageFallback} aria-hidden="true" />
                    )}
                  </div>

                  <div className={styles.body}>
                    {article.categories.length > 0 && (
                      <span
                        className={styles.category}
                        style={article.categories[0].color ? { color: article.categories[0].color } : undefined}
                      >
                        {article.categories[0].name}
                      </span>
                    )}
                    <h3 className={styles.cardTitle}>{article.title}</h3>
                    {article.excerpt && <p className={styles.excerpt}>{article.excerpt}</p>}
                    <span className={styles.meta}>
                      {article.publishedAt && (
                        <>
                          <time dateTime={article.publishedAt}>{new Date(article.publishedAt).toLocaleDateString(locale)}</time>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      {article.readingTimeMinutes} {t.shop.minRead}
                    </span>
                  </div>
                </Link>
              </article>
            ))}
          </div>

          {items.length > 1 && (
            <>
              <button
                type="button"
                className={`${styles.arrow} ${styles.arrowPrev}`}
                onClick={() => carousel.scrollByCard(-1)}
                disabled={!carousel.canScrollPrev}
                aria-label={t.shop.carouselPrev}
              >
                <ChevronLeft size={20} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className={`${styles.arrow} ${styles.arrowNext}`}
                onClick={() => carousel.scrollByCard(1)}
                disabled={!carousel.canScrollNext}
                aria-label={t.shop.carouselNext}
              >
                <ChevronRight size={20} strokeWidth={2.25} />
              </button>
            </>
          )}
        </div>

        {items.length > 1 && (
          <div className={styles.dots}>
            {items.map((article, i) => (
              <button
                key={article.id}
                type="button"
                className={`${styles.dot} ${i === carousel.activeIndex ? styles.dotActive : ""}`}
                onClick={() => carousel.scrollToIndex(i)}
                aria-label={`${t.shop.goToArticle} ${i + 1}`}
                aria-current={i === carousel.activeIndex}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
