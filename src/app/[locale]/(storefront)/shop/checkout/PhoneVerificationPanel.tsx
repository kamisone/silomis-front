"use client";

import { useEffect, useRef, useState } from "react";
import type { getTranslations } from "@/lib/i18n";
import styles from "./Checkout.module.css";

type T = ReturnType<typeof getTranslations>;

interface Props {
  cartToken: string;
  phone: string;
  country: string;
  locale: string;
  t: T;
  /** The code was right: the parent submits the address again, which now goes through. */
  onVerified: () => void;
}

/** The API's error codes (PhoneVerificationService) → what the customer reads. */
function messageFor(code: string | undefined, t: T): string {
  switch (code) {
    case "INVALID_CODE":
      return t.shop.verifyPhoneErrInvalid;
    case "CODE_EXPIRED":
      return t.shop.verifyPhoneErrExpired;
    case "TOO_MANY_ATTEMPTS":
      return t.shop.verifyPhoneErrTooMany;
    case "TOO_MANY_SENDS":
      return t.shop.verifyPhoneErrTooManySends;
    default:
      return t.shop.verifyPhoneErrSend;
  }
}

/**
 * The step a phone-only customer goes through when the shop has switched
 * phone verification on: a code is texted (through the shop's SMS gateway)
 * as soon as this opens, they type it back, and the address is submitted
 * again. Sits inside the address form, so Enter in the code field is caught
 * here rather than submitting the address.
 *
 * The gateway is a phone that polls for messages, so a code can take a
 * moment; the way out — adding an email instead — is always on screen.
 */
export default function PhoneVerificationPanel({ cartToken, phone, country, locale, t, onVerified }: Props) {
  const [masked, setMasked] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const sentOnce = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send() {
    setError("");
    const res = await fetch("/next-api/public/shop/checkout/phone-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartToken, phone, country, locale }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) {
      setMasked(body.maskedPhone ?? phone);
      setResendIn(body.resendAfterSec ?? 30);
      inputRef.current?.focus();
    } else if (body?.code === "RESEND_TOO_SOON") {
      // A code is already on its way (a double tap, or a remount): just wait.
      setMasked((m) => m ?? phone);
      setResendIn(body.retryAfterSec ?? 30);
    } else {
      setError(messageFor(body?.code, t));
    }
  }

  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    void send();
    // Sent once on opening; the parent remounts this for a new number.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function confirm() {
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6 || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/next-api/public/shop/checkout/phone-code/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartToken, phone, country, code: digits }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok && body?.verified) {
      onVerified();
      return;
    }
    setError(messageFor(body?.code ?? "INVALID_CODE", t));
    setCode("");
  }

  return (
    <div className={styles.verifyPanel} role="group" aria-labelledby="co-verify-title">
      <p id="co-verify-title" className={styles.verifyTitle}>
        {t.shop.verifyPhoneTitle}
      </p>
      {masked && <p className={styles.verifyText}>{t.shop.verifyPhoneSent.replace("{phone}", masked)}</p>}
      <div className={styles.verifyRow}>
        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label htmlFor="co-verify-code">{t.shop.verifyPhoneCodeLabel}</label>
          <input
            ref={inputRef}
            id="co-verify-code"
            className={styles.verifyInput}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "co-verify-error" : undefined}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d ]/g, "");
              setCode(next);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirm();
              }
            }}
          />
        </div>
        <button type="button" className={styles.verifyBtn} onClick={confirm} disabled={busy || code.replace(/\D/g, "").length !== 6}>
          {t.shop.verifyPhoneConfirm}
        </button>
      </div>
      {error && (
        <p id="co-verify-error" className={styles.verifyError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.verifyFoot}>
        <button type="button" className={styles.verifyLink} onClick={() => void send()} disabled={resendIn > 0}>
          {resendIn > 0 ? t.shop.verifyPhoneResendIn.replace("{s}", String(resendIn)) : t.shop.verifyPhoneResend}
        </button>
        <span className={styles.verifyHint}>{t.shop.verifyPhoneEmailInstead}</span>
      </div>
    </div>
  );
}
