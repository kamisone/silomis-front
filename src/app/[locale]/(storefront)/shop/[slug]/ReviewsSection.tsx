"use client";

import { useEffect, useState } from "react";
import WriteReviewForm from "./WriteReviewForm";
import { getTranslations, toBcp47, type Locale } from "@/lib/i18n";
import styles from "./ProductDetail.module.css";
import reviewStyles from "./ReviewsSection.module.css";

interface ReviewMedia {
  key: string;
  type: "image" | "video";
  url: string;
}

interface Review {
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
  distribution: Record<string, number>;
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

export default function ReviewsSection({ productId, locale }: { productId: string; locale: Locale }) {
  const t = getTranslations(locale);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load(limit = 10) {
    setLoading(true);
    try {
      const [statsRes, reviewsRes] = await Promise.all([
        fetch(`/next-api/public/shop/reviews/product/${productId}/stats`, { cache: "no-store" }).catch(() => null),
        fetch(`/next-api/public/shop/reviews/product/${productId}?limit=${limit}`, { cache: "no-store" }).catch(() => null),
      ]);
      if (statsRes?.ok) setStats(await statsRes.json());
      if (reviewsRes?.ok) {
        const data = await reviewsRes.json();
        setReviews(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.shop.reviewsHeading}</h2>

      {stats && stats.count > 0 && (
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
              const count = stats.distribution[String(n)] ?? 0;
              const pct = stats.count > 0 ? Math.round((count / stats.count) * 100) : 0;
              return (
                <div key={n} className={reviewStyles.distributionRow}>
                  <span>{n}★</span>
                  <div className={reviewStyles.distributionBarTrack}>
                    <div className={reviewStyles.distributionBarFill} style={{ width: `${pct}%` }} />
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

      {!loading && reviews.length === 0 && <p className={reviewStyles.empty}>{t.shop.reviewsEmpty}</p>}

      <div className={reviewStyles.list}>
        {reviews.map((r) => (
          <div key={r.id} className={reviewStyles.card}>
            <div className={reviewStyles.cardHeader}>
              <Stars rating={r.rating} />
              {r.isVerifiedPurchase && <span className={reviewStyles.verifiedBadge}>{t.shop.reviewVerifiedBadge}</span>}
            </div>
            {r.title && <p className={reviewStyles.cardTitle}>{r.title}</p>}
            {r.body && <p className={reviewStyles.cardBody}>{r.body}</p>}
            {r.media.length > 0 && (
              <div className={reviewStyles.cardMedia}>
                {r.media.map((m) =>
                  m.type === "video" ? (
                    <video key={m.key} src={m.url} controls className={reviewStyles.cardMediaItem} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.key} src={m.url} alt="" className={reviewStyles.cardMediaItem} />
                  ),
                )}
              </div>
            )}
            <p className={reviewStyles.cardMeta}>
              {r.authorName} — {new Date(r.createdAt).toLocaleDateString(toBcp47(locale))}
            </p>
          </div>
        ))}
      </div>

      {reviews.length < total && (
        <button type="button" className={reviewStyles.loadMore} onClick={() => load(reviews.length + 10)}>
          {t.shop.reviewLoadMore}
        </button>
      )}

      {showForm && (
        <WriteReviewForm
          productId={productId}
          locale={locale}
          onClose={() => setShowForm(false)}
          onSubmitted={() => {
            setShowForm(false);
            load(Math.max(reviews.length, 10));
          }}
        />
      )}
    </section>
  );
}
