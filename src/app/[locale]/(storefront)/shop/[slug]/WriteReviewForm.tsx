"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Check } from "lucide-react";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./ReviewsSection.module.css";

const Turnstile = dynamic(() => import("@/components/Turnstile"), { ssr: false });
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type Step = "verify" | "write" | "success";

interface ExistingReview {
  authorName: string;
  rating: number;
  title: string | null;
  body: string | null;
  media: Array<{ key: string; type: "image" | "video"; url: string }>;
}

interface MediaDraft {
  file: File;
  previewUrl: string;
  isVideo: boolean;
}

export default function WriteReviewForm({ productId, locale, onClose, onSubmitted }: { productId: string; locale: Locale; onClose: () => void; onSubmitted: () => void }) {
  const t = getTranslations(locale);
  const dialogRef = useRef<HTMLDivElement>(null);
  const needsTurnstile = !!TURNSTILE_SITE_KEY;

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
  const [newMedia, setNewMedia] = useState<MediaDraft[]>([]);
  const [keepMediaKeys, setKeepMediaKeys] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Lazy initializer — runs once on mount, not on every render (unlike `useState(Date.now())`).
  const [renderedAt] = useState(() => Date.now());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("input, textarea, button")?.focus();
  }, [step]);

  useEffect(() => () => {
    newMedia.forEach((m) => URL.revokeObjectURL(m.previewUrl));
  }, [newMedia]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const drafts: MediaDraft[] = Array.from(files).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      isVideo: file.type.startsWith("video/"),
    }));
    setNewMedia((prev) => [...prev, ...drafts].slice(0, 5));
  }

  function removeNewMedia(index: number) {
    setNewMedia((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

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
    if (rating < 1 || !authorName.trim() || submitting) return;
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
      if (turnstileToken) form.set("_token", turnstileToken);
      for (const m of newMedia) form.append("media", m.file);

      const res = await fetch("/next-api/public/shop/reviews", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? t.shop.reviewSubmitError);
        return;
      }
      setStep("success");
      onSubmitted();
    } catch {
      setError(t.shop.reviewSubmitError);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = rating >= 1 && authorName.trim().length > 0 && (!needsTurnstile || !!turnstileToken);

  return createPortal(
    <div className={styles.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className={styles.modalPanel} role="dialog" aria-modal="true">
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label={t.shop.reviewClose}>
          ×
        </button>

        {step === "verify" && (
          <form onSubmit={handleVerify} className={styles.modalForm}>
            <h3>{t.shop.reviewModalTitleVerify}</h3>
            <p className={styles.modalHint}>{t.shop.reviewVerifyHint}</p>
            {error && <p className={styles.modalError}>{error}</p>}
            <label>
              {t.shop.reviewOrderNumber} <span className={styles.req}>*</span>
              <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder={t.shop.reviewOrderNumberPlaceholder} required />
            </label>
            <label>
              {t.shop.reviewEmail} <span className={styles.req}>*</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.shop.reviewEmailPlaceholder} required />
            </label>
            <button type="submit" disabled={verifying}>
              {verifying ? t.shop.reviewVerifying : t.shop.reviewVerifyBtn}
            </button>
          </form>
        )}

        {step === "write" && (
          <form onSubmit={handleSubmit} className={styles.modalForm}>
            <h3>{existing ? t.shop.reviewEditTitle : t.shop.reviewModalTitleWrite}</h3>
            {existing && <p className={styles.modalHint}>{t.shop.reviewEditNotice}</p>}
            {error && <p className={styles.modalError}>{error}</p>}

            <div className={styles.honeypot} aria-hidden="true">
              <label htmlFor="rv-hp">Leave this field blank</label>
              <input id="rv-hp" type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
            </div>

            <label>
              {t.shop.reviewYourName} <span className={styles.req}>*</span>
              <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} maxLength={300} placeholder={t.shop.reviewYourNamePlaceholder} required />
            </label>

            <span className={styles.label}>
              {t.shop.reviewRating} <span className={styles.req}>*</span>
            </span>
            <div className={styles.ratingInput} role="radiogroup" aria-label={t.shop.reviewRating}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(n)} aria-label={`${n} star${n === 1 ? "" : "s"}`}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill={n <= (hoverRating || rating) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              ))}
            </div>

            <label>
              {t.shop.reviewTitleField}
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} placeholder={t.shop.reviewTitlePlaceholder} />
            </label>

            <label>
              {t.shop.reviewBodyField}
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={4} placeholder={t.shop.reviewBodyPlaceholder} />
            </label>

            <div className={styles.mediaField}>
              <span className={styles.mediaLabel}>{t.shop.reviewMedia}</span>
              <label className={styles.mediaPicker}>
                {t.shop.reviewAddMedia}
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className={styles.modalHint}>{t.shop.reviewMediaHint}</p>

              {(existing?.media.length || newMedia.length > 0) && (
                <div className={styles.existingMedia}>
                  {existing?.media.map((m) => (
                    <div key={m.key} className={keepMediaKeys.includes(m.key) ? "" : styles.mediaRemoved}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {m.type === "video" ? <video src={m.url} muted className={styles.mediaPreviewItem} /> : <img src={m.url} alt="" className={styles.mediaPreviewItem} />}
                      <button type="button" onClick={() => setKeepMediaKeys((prev) => (prev.includes(m.key) ? prev.filter((k) => k !== m.key) : [...prev, m.key]))}>
                        {keepMediaKeys.includes(m.key) ? t.shop.promoRemove : t.shop.keepLabel}
                      </button>
                    </div>
                  ))}
                  {newMedia.map((m, i) => (
                    <div key={m.previewUrl}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {m.isVideo ? <video src={m.previewUrl} muted className={styles.mediaPreviewItem} /> : <img src={m.previewUrl} alt="" className={styles.mediaPreviewItem} />}
                      <button type="button" onClick={() => removeNewMedia(i)} aria-label="Remove">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {needsTurnstile && (
              <Turnstile siteKey={TURNSTILE_SITE_KEY} locale={locale} onToken={setTurnstileToken} onExpire={() => setTurnstileToken(null)} onError={() => setTurnstileToken(null)} />
            )}

            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setStep("verify")}>
                {t.shop.reviewBack}
              </button>
              <button type="submit" disabled={!canSubmit || submitting} style={{ flex: 1 }}>
                {submitting ? t.shop.reviewSubmitting : t.shop.reviewSubmit}
              </button>
            </div>
          </form>
        )}

        {step === "success" && (
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <Check size={20} strokeWidth={2.25} />
            </div>
            <h3 className={styles.successTitle}>{t.shop.reviewSuccessTitle}</h3>
            <p className={styles.successSub}>{t.shop.reviewSuccessSub}</p>
            <button type="button" onClick={onClose}>
              {t.shop.reviewDone}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
