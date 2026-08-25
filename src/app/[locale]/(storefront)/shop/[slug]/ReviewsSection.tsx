"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, Play, X } from "lucide-react";
import WriteReviewForm from "./WriteReviewForm";
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
  const [viewerMedia, setViewerMedia] = useState<ReviewMedia | null>(null);

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
      <h2 className={styles.sectionTitle}>{t.shop.reviewsHeading}</h2>

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

      <button type="button" className={reviewStyles.writeButton} onClick={() => setShowForm(true)}>
        {t.shop.reviewsWriteBtn}
      </button>

      {reviews.length === 0 && <p className={reviewStyles.empty}>{t.shop.reviewsEmpty}</p>}

      <div className={reviewStyles.list}>
        {reviews.map((r) => (
          <div key={r.id} className={reviewStyles.card}>
            <div className={reviewStyles.cardHeader}>
              <Stars rating={r.rating} />
              {r.isVerifiedPurchase && (
                <span className={reviewStyles.verifiedBadge}>
                  <BadgeCheck size={13} strokeWidth={2} /> {t.shop.reviewVerifiedBadge}
                </span>
              )}
            </div>
            <div className={reviewStyles.cardAuthorRow}>
              <span className={reviewStyles.cardAuthor}>{r.authorName}</span>
              <span aria-hidden="true">·</span>
              <span className={reviewStyles.cardDate}>{formatDate(r.createdAt, locale)}</span>
            </div>
            {r.title && <p className={reviewStyles.cardTitle}>{r.title}</p>}
            {r.body && <p className={reviewStyles.cardBody}>{r.body}</p>}
            {r.media.length > 0 && (
              <div className={reviewStyles.cardMedia}>
                {r.media.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={reviewStyles.mediaThumbBtn}
                    onClick={() => setViewerMedia(m)}
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
          </div>
        ))}
      </div>

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

      {viewerMedia &&
        createPortal(
          <div className={reviewStyles.viewerOverlay} onMouseDown={(e) => e.target === e.currentTarget && setViewerMedia(null)}>
            <div className={reviewStyles.viewerPanel} role="dialog" aria-modal="true" aria-label="Media viewer">
              <button type="button" className={reviewStyles.viewerClose} onClick={() => setViewerMedia(null)} aria-label={t.shop.reviewClose}>
                <X size={18} strokeWidth={2} />
              </button>
              {viewerMedia.type === "video" ? (
                <video src={viewerMedia.url} controls autoPlay className={reviewStyles.viewerMedia} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewerMedia.url} alt={viewerMedia.altText ?? ""} className={reviewStyles.viewerMedia} />
              )}
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
