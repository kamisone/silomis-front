"use client";

import { useState, type FormEvent } from "react";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./ReviewsSection.module.css";

type Step = "verify" | "write" | "success";

interface ExistingReview {
  authorName: string;
  rating: number;
  title: string | null;
  body: string | null;
  media: Array<{ key: string; type: "image" | "video"; url: string }>;
}

export default function WriteReviewForm({ productId, locale, onClose, onSubmitted }: { productId: string; locale: Locale; onClose: () => void; onSubmitted: () => void }) {
  const t = getTranslations(locale);
  const [step, setStep] = useState<Step>("verify");
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [existing, setExisting] = useState<ExistingReview | null>(null);

  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [keepMediaKeys, setKeepMediaKeys] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  // Lazy initializer — runs once on mount, not on every render (unlike `useState(Date.now())`).
  const [renderedAt] = useState(() => Date.now());

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/next-api/public/shop/reviews/verify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, productId, email: email || undefined }),
      });
      const data = await res.json();
      if (!data.verified) {
        setError(t.shop.reviewVerifyError);
        return;
      }
      if (data.alreadyReviewed && data.existing) {
        setExisting(data.existing);
        setAuthorName(data.existing.authorName);
        setRating(data.existing.rating);
        setTitle(data.existing.title ?? "");
        setBody(data.existing.body ?? "");
        setKeepMediaKeys(data.existing.media.map((m: { key: string }) => m.key));
      }
      setStep("write");
    } catch {
      setError(t.shop.reviewSubmitError);
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating < 1 || !authorName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("orderNumber", orderNumber);
      form.set("productId", productId);
      if (email) form.set("email", email);
      form.set("authorName", authorName);
      form.set("rating", String(rating));
      if (title) form.set("title", title);
      if (body) form.set("body", body);
      if (existing) form.set("keepMediaKeys", JSON.stringify(keepMediaKeys));
      form.set("_hp", honeypot);
      form.set("_t", String(renderedAt));
      for (const file of files.slice(0, 5)) form.append("media", file);

      const res = await fetch("/next-api/public/shop/reviews", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? t.shop.reviewSubmitError);
        return;
      }
      setStep("success");
    } catch {
      setError(t.shop.reviewSubmitError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalPanel}>
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label={t.shop.reviewClose}>
          ×
        </button>

        {step === "verify" && (
          <form onSubmit={handleVerify} className={styles.modalForm}>
            <h3>{t.shop.reviewModalTitleWrite}</h3>
            <p className={styles.modalHint}>{t.shop.reviewVerifyHint}</p>
            {error && <p className={styles.modalError}>{error}</p>}
            <label>
              {t.shop.reviewOrderNumber}
              <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
            </label>
            <label>
              {t.shop.reviewEmail}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <button type="submit" disabled={verifying}>
              {verifying ? t.shop.reviewVerifying : t.shop.continueBtn}
            </button>
          </form>
        )}

        {step === "write" && (
          <form onSubmit={handleSubmit} className={styles.modalForm}>
            <h3>{existing ? t.shop.reviewEditTitle : t.shop.reviewModalTitleWrite}</h3>
            {error && <p className={styles.modalError}>{error}</p>}

            <input type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} />

            <label>
              {t.shop.reviewYourName}
              <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} maxLength={300} required />
            </label>

            <div className={styles.ratingInput} role="radiogroup" aria-label={t.shop.reviewRating}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(n)} aria-label={`${n} star${n === 1 ? "" : "s"}`}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill={n <= (hoverRating || rating) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              ))}
            </div>

            <label>
              {t.shop.reviewTitleField}
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} />
            </label>

            <label>
              {t.shop.reviewBodyField}
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={4} />
            </label>

            {existing && existing.media.length > 0 && (
              <div className={styles.existingMedia}>
                {existing.media.map((m) => (
                  <div key={m.key} className={keepMediaKeys.includes(m.key) ? "" : styles.mediaRemoved}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="" width={60} height={60} style={{ objectFit: "cover" }} />
                    <button type="button" onClick={() => setKeepMediaKeys((prev) => (prev.includes(m.key) ? prev.filter((k) => k !== m.key) : [...prev, m.key]))}>
                      {keepMediaKeys.includes(m.key) ? t.shop.promoRemove : t.shop.keepLabel}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label>
              {t.shop.reviewMedia}
              <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} />
            </label>

            <button type="submit" disabled={submitting || rating < 1 || !authorName.trim()}>
              {submitting ? t.shop.reviewSubmitting : t.shop.reviewSubmit}
            </button>
          </form>
        )}

        {step === "success" && (
          <div className={styles.modalForm}>
            <h3>{t.shop.reviewSuccessTitle}</h3>
            <p>{t.shop.reviewSuccessSub}</p>
            <button type="button" onClick={onSubmitted}>
              {t.shop.reviewDone}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
