"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { getTranslations, toBcp47, type Locale } from "@/lib/i18n";
import styles from "./ProductDetail.module.css";

const INSTALMENTS = 3;

/** Klarna's pink badge with its wordmark — inline, like the payment marks. */
export function KlarnaMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 52 22" role="img" aria-label="Klarna" focusable="false">
      <rect width="52" height="22" rx="5" fill="#FFB3C7" />
      <text x="26" y="15" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="10.5" fontWeight="800" fill="#0B051D" letterSpacing="-0.2">
        Klarna.
      </text>
    </svg>
  );
}

interface Props {
  locale: Locale;
  /** What the customer would pay for the current selection (unit price × quantity). */
  totalCents: number;
}

/**
 * "3 interest-free payments of €46.00 with [Klarna] Learn more" under the
 * price. Each instalment is rounded up to the cent, so the line never shows
 * less than Klarna will actually take. "Learn more" opens a short explainer;
 * whether Klarna is offered is still decided at checkout (country, amount,
 * Klarna's approval), which the explainer says.
 */
export default function KlarnaInstalments({ locale, totalCents }: Props) {
  const t = getTranslations(locale).shop;
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (totalCents <= 0) return null;

  const amount = (Math.ceil(totalCents / INSTALMENTS) / 100).toLocaleString(toBcp47(locale), { style: "currency", currency: "EUR" });
  const parts = t.klarnaInstalments.replace("{count}", String(INSTALMENTS)).split("{amount}");

  return (
    <>
      <p className={styles.klarnaLine}>
        <span>
          {parts.map((part, i) => (
            <Fragment key={i}>
              {i > 0 && <strong>{amount}</strong>}
              {part}
            </Fragment>
          ))}
        </span>{" "}
        <KlarnaMark className={styles.klarnaMark} />{" "}
        <button type="button" className={styles.klarnaLearnMore} onClick={() => setOpen(true)} aria-haspopup="dialog">
          {t.klarnaLearnMore}
        </button>
      </p>

      {open && (
        <div className={styles.klarnaOverlay} onClick={() => setOpen(false)}>
          <div className={styles.klarnaDialog} role="dialog" aria-modal="true" aria-labelledby="klarna-info-title" onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} type="button" className={styles.klarnaClose} onClick={() => setOpen(false)} aria-label={t.klarnaInfoClose}>
              <X size={18} aria-hidden="true" />
            </button>
            <KlarnaMark className={styles.klarnaDialogMark} />
            <h2 id="klarna-info-title" className={styles.klarnaDialogTitle}>
              {t.klarnaInfoTitle.replace("{count}", String(INSTALMENTS))}
            </h2>
            <ol className={styles.klarnaSteps}>
              {[t.klarnaInfoStep1, t.klarnaInfoStep2, t.klarnaInfoStep3].map((step, i) => (
                <li key={i}>
                  <span className={styles.klarnaStepNum} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>{step.replace("{count}", String(INSTALMENTS))}</span>
                </li>
              ))}
            </ol>
            <p className={styles.klarnaNote}>{t.klarnaInfoNote}</p>
          </div>
        </div>
      )}
    </>
  );
}
