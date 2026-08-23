"use client";

import { useState } from "react";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./PromoCodeInput.module.css";

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export interface ValidateCouponResult {
  valid: boolean;
  discountCents: number;
  freeShipping: boolean;
  name?: string;
  /** Stable reason code from the backend — mapped to a plain-English string below, never shown raw. */
  reason?: "invalid" | "not_yet_active" | "expired" | "usage_limit_reached" | "min_order_not_met";
}

interface Props {
  onValidate: (code: string) => Promise<ValidateCouponResult>;
  onApply: (code: string, result: ValidateCouponResult) => void;
  onRemove: () => void;
  appliedCode?: string | null;
  appliedDiscountCents?: number;
  locked?: boolean;
}

function centsToEuros(c: number) {
  return (c / 100).toFixed(2);
}

export default function PromoCodeInput({ onValidate, onApply, onRemove, appliedCode, appliedDiscountCents, locked = false }: Props) {
  const t = getTranslations(useLocale());
  const ERROR_MESSAGES: Record<NonNullable<ValidateCouponResult["reason"]>, string> = {
    invalid: t.shop.promoInvalidCode,
    not_yet_active: t.shop.promoNotYetActive,
    expired: t.shop.promoExpired,
    usage_limit_reached: t.shop.promoUsageLimitReached,
    min_order_not_met: t.shop.promoMinOrderNotMet,
  };
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ValidateCouponResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await onValidate(trimmed);
      setResult(res);
      if (res.valid) {
        onApply(trimmed, res);
        setCode("");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleRemove() {
    setCode("");
    setResult(null);
    onRemove();
  }

  if (appliedCode) {
    return (
      <div className={styles.root}>
        <p className={styles.label}>{t.shop.promoCodeLabel}</p>
        <div className={styles.row}>
          <input className={`${styles.input} ${styles.inputValid}`} value={appliedCode} readOnly disabled />
          {!locked && (
            <button type="button" className={styles.removeBtn} onClick={handleRemove}>
              {t.shop.promoRemove}
            </button>
          )}
        </div>
        {appliedDiscountCents !== undefined && appliedDiscountCents > 0 && (
          <div className={`${styles.feedback} ${styles.feedbackValid}`}>
            <em className={styles.feedbackIcon}>
              <CheckIcon />
            </em>
            {t.shop.promoAppliedAmount.replace("{amount}", `€${centsToEuros(appliedDiscountCents)}`)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <p className={styles.label}>{t.shop.promoCodeLabel}</p>
      <div className={styles.row}>
        <input
          className={`${styles.input} ${result ? (result.valid ? styles.inputValid : styles.inputInvalid) : ""}`}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleApply();
            }
          }}
          placeholder={t.shop.promoEnterCode}
          disabled={loading || locked}
          maxLength={50}
        />
        <button type="button" className={styles.applyBtn} onClick={handleApply} disabled={!code.trim() || loading || locked}>
          {loading ? "…" : t.shop.promoApply}
        </button>
      </div>
      {result && !result.valid && (
        <div className={`${styles.feedback} ${styles.feedbackInvalid}`}>
          <em className={styles.feedbackIcon}>
            <XIcon />
          </em>
          {ERROR_MESSAGES[result.reason ?? "invalid"]}
        </div>
      )}
    </div>
  );
}
