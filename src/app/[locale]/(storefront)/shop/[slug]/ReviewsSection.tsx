"use client";

import { useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, PenLine, Play } from "lucide-react";
import { useCarousel } from "@/components/shop/useCarousel";
import WriteReviewForm from "./WriteReviewForm";
import ReviewMediaViewer, { type ViewerTarget } from "./ReviewMediaViewer";
import { getTranslations, toBcp47, type Locale } from "@/lib/i18n";
import styles from "./ProductDetail.module.css";
import reviewStyles from "./ReviewsSection.module.css";

interface ReviewMedia {
  key: string;
  type: "image" | "video";
  url: string;
  altText?: string | null;
}

export interface ReviewItem {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string | null;
  media: ReviewMedia[];
  isVerifiedPurchase: boolean;
  createdAt: string;
}

interface Stats {
  average: number;
  count: number;
  distribution?: Record<string, number>;
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(toBcp47(locale), { day: "2-digit", month: "short", year: "numeric" });
}

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className={reviewStyles.stars} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" fill={n <= Math.round(rating) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

/**
 * The reviewer's initials over a colour picked from their name.
 *
 * A stable hash rather than a random pick, so the same person keeps the same
 * colour between renders and pages; the hue wheel is sampled at a fixed
 * saturation and lightness so every avatar sits at the same weight and none of
 * them fights the star row above it.
 */
function Avatar({ name }: { name: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={reviewStyles.avatar}
      style={{ background: `hsl(${hash} 58% 92%)`, color: `hsl(${hash} 52% 32%)` }}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}

interface Props {
  productId: string;
  locale: Locale;
  stats: Stats;
  initialReviews: { items: ReviewItem[]; total: number };
}

export default function ReviewsSection({ productId, locale, stats, initialReviews }: Props) {
  const t = getTranslations(locale);
  const [reviews, setReviews] = useState(initialReviews.items);
  const [total, setTotal] = useState(initialReviews.total);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewerTarget, setViewerTarget] = useState<ViewerTarget | null>(null);
  const carousel = useCarousel({ count: reviews.length, draggingClass: reviewStyles.dragging });

  const distribution = stats.distribution ?? {};
  const maxCount = Math.max(1, ...[1, 2, 3, 4, 5].map((n) => distribution[String(n)] ?? 0));

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/next-api/public/shop/reviews/product/${productId}?limit=10&offset=${reviews.length}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setReviews((prev) => [...prev, ...(data.items ?? [])]);
        setTotal(data.total ?? total);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  async function refreshFirstPage() {
    const res = await fetch(`/next-api/public/shop/reviews/product/${productId}?limit=${Math.max(reviews.length, 10)}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setReviews(data.items ?? []);
      setTotal(data.total ?? total);
    }
  }

  return (
    <section id="reviews" className={styles.section}>
      <div className={reviewStyles.headingRow}>
        <h2 className={`${styles.sectionTitle} ${reviewStyles.heading}`}>{t.shop.reviewsHeading}</h2>
        <button type="button" className={reviewStyles.writeButton} onClick={() => setShowForm(true)}>
          <PenLine size={14} strokeWidth={2.25} aria-hidden="true" />
          {t.shop.reviewsWriteBtn}
        </button>
      </div>

      {stats.count > 0 && (
        <div className={reviewStyles.summary}>
          <div className={reviewStyles.summaryScore}>
            <span className={reviewStyles.summaryAverage}>{stats.average.toFixed(1)}</span>
            <Stars rating={stats.average} size={18} />
            <span className={reviewStyles.summaryCount}>
              {stats.count} {stats.count === 1 ? t.shop.reviewCountSingular : t.shop.reviewCountPlural}
            </span>
          </div>
          <div className={reviewStyles.distribution}>
            {[5, 4, 3, 2, 1].map((n) => {
              const count = distribution[String(n)] ?? 0;
              return (
                <div key={n} className={reviewStyles.distributionRow}>
                  <span>{n}★</span>
                  <div className={reviewStyles.distributionBarTrack}>
                    <div className={reviewStyles.distributionBarFill} style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reviews.length === 0 && <p className={reviewStyles.empty}>{t.shop.reviewsEmpty}</p>}

      {reviews.length > 0 && (
        <div className={reviewStyles.carousel}>
          <div className={reviewStyles.viewport}>
            <div
              {...carousel.trackProps}
              className={reviewStyles.track}
              role="group"
              aria-roledescription="carousel"
              aria-label={t.shop.reviewsHeading}
              tabIndex={0}
            >
              {reviews.map((r, i) => (
                <article key={r.id} ref={carousel.setSlideRef(i)} className={reviewStyles.slide}>
                  <div className={reviewStyles.card}>
                    <div className={reviewStyles.cardHeader}>
                      <Stars rating={r.rating} />
                      {r.isVerifiedPurchase && (
                        <span className={reviewStyles.verifiedBadge}>
                          <BadgeCheck size={13} strokeWidth={2} /> {t.shop.reviewVerifiedBadge}
                        </span>
                      )}
                    </div>

                    {/* The copy is what varies wildly in length, so it is the part
                        that scrolls — the header and the byline stay pinned, which
                        is what keeps a row of cards reading as a row. */}
                    <div className={reviewStyles.cardCopy}>
                      {r.title && <p className={reviewStyles.cardTitle}>{r.title}</p>}
                      {r.body && <p className={reviewStyles.cardBody}>{r.body}</p>}
                    </div>

                    {r.media.length > 0 && (
                      <div className={reviewStyles.cardMedia}>
                        {r.media.map((m) => (
                          <button
                            key={m.key}
                            type="button"
                            className={reviewStyles.mediaThumbBtn}
                            onClick={() => setViewerTarget({ reviewId: r.id, mediaKey: m.key })}
                            aria-label={m.type === "video" ? "Play video" : "View image"}
                          >
                            {m.type === "video" ? (
                              <video src={m.url} muted playsInline className={reviewStyles.cardMediaItem} />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.url} alt={m.altText ?? ""} loading="lazy" className={reviewStyles.cardMediaItem} />
                            )}
                            {m.type === "video" && (
                              <span className={reviewStyles.mediaPlayBadge} aria-hidden="true">
                                <Play size={16} fill="currentColor" />
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    <footer className={reviewStyles.cardFooter}>
                      <Avatar name={r.authorName} />
                      <span className={reviewStyles.cardAuthorRow}>
                        <span className={reviewStyles.cardAuthor}>{r.authorName}</span>
                        <span className={reviewStyles.cardDate}>{formatDate(r.createdAt, locale)}</span>
                      </span>
                    </footer>
                  </div>
                </article>
              ))}
            </div>

            {reviews.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${reviewStyles.arrow} ${reviewStyles.arrowPrev}`}
                  onClick={() => carousel.scrollByCard(-1)}
                  disabled={!carousel.canScrollPrev}
                  aria-label={t.shop.reviewsPrev}
                >
                  <ChevronLeft size={20} strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  className={`${reviewStyles.arrow} ${reviewStyles.arrowNext}`}
                  onClick={() => carousel.scrollByCard(1)}
                  disabled={!carousel.canScrollNext}
                  aria-label={t.shop.reviewsNext}
                >
                  <ChevronRight size={20} strokeWidth={2.25} />
                </button>
              </>
            )}
          </div>

        </div>
      )}

      {reviews.length < total && (
        <button type="button" className={reviewStyles.loadMore} onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "…" : t.shop.reviewLoadMore}
        </button>
      )}

      {showForm && (
        <WriteReviewForm
          productId={productId}
          locale={locale}
          onClose={() => setShowForm(false)}
          onSubmitted={refreshFirstPage}
        />
      )}

      {viewerTarget && (
        <ReviewMediaViewer
          reviews={reviews}
          target={viewerTarget}
          onClose={() => setViewerTarget(null)}
          locale={locale}
          t={t}
        />
      )}

    </section>
  );
}
