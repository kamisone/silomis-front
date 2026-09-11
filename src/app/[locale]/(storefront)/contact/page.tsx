"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { getTranslations } from "@/lib/i18n";
import styles from "./contact.module.css";
import Link from "next/link";

const Turnstile = dynamic(() => import("@/components/Turnstile"), { ssr: false });

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * One consent line: a real checkbox, a drawn box, and a sentence that carries
 * a link to the document being accepted.
 *
 * The input is visually hidden rather than replaced, so the label association,
 * focus order, keyboard toggle and form semantics stay the browser's — only
 * the box is drawn, because a native checkbox cannot be sized or coloured
 * consistently across platforms.
 */
function ConsentCheckbox({
  checked,
  onChange,
  template,
  linkText,
  href,
  invalid,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Carries a `{link}` placeholder — the article differs by language
   *  ("les"/"la"), so the whole sentence has to be translatable, not glued
   *  together from fragments. */
  template: string;
  linkText: string;
  href: string;
  invalid: boolean;
}) {
  const [before, after] = template.split("{link}");

  return (
    <label className={`${styles.consent} ${checked ? styles.consentChecked : ""} ${invalid ? styles.consentInvalid : ""}`}>
      <input
        type="checkbox"
        className={styles.consentInput}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined}
        required
      />
      <span className={styles.consentBox} aria-hidden="true">
        <Check size={12} strokeWidth={3.2} />
      </span>
      <span className={styles.consentText}>
        {before}
        <Link
          href={href}
          className={styles.consentLink}
          target="_blank"
          rel="noopener noreferrer"
          // Without this the click reaches the label and toggles the box on
          // the way out — the reader would come back to a form that silently
          // changed state behind them. A new tab also keeps their typed
          // message intact.
          onClick={(e) => e.stopPropagation()}
        >
          {linkText}
        </Link>
        {after}
        <span className={styles.consentReq} aria-hidden="true"> *</span>
      </span>
    </label>
  );
}

export default function ContactPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const t = getTranslations(locale).contact;

  const [form, setForm]         = useState({ name: "", contact: "", subject: "", message: "" });
  const [consent, setConsent]   = useState({ terms: false, privacy: false });
  /** Only after a blocked submit — nagging before the first attempt is rude. */
  const [consentTouched, setConsentTouched] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [token, setToken]       = useState<string | null>(null);
  const [status, setStatus]     = useState<"idle" | "sending" | "success" | "error">("idle");
  const renderedAt              = useRef<number>(0);

  useEffect(() => { renderedAt.current = Date.now(); }, []);

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const needsTurnstile = !!TURNSTILE_SITE_KEY;
  const consentGiven = consent.terms && consent.privacy;
  const canSubmit = status === "idle" && consentGiven && (!needsTurnstile || !!token);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentGiven) {
      setConsentTouched(true);
      return;
    }
    if (!canSubmit) return;
    setStatus("sending");
    try {
      const res = await fetch("/next-api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:    form.name.trim(),
          contact: form.contact.trim(),
          subject: form.subject.trim(),
          message: form.message.trim(),
          _hp:     honeypot || undefined,
          _t:      renderedAt.current || undefined,
          _token:  token ?? undefined,
        }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className={styles.page}>

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true">
          <div className={styles.heroBgGlowWhite} />
        </div>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>{t.eyebrow}</span>
          <h1 className={styles.heroTitle}>{t.title}</h1>
          <p className={styles.heroSub}>{t.sub}</p>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className={styles.formSection}>
        <div className={styles.formCard}>
          {status === "success" ? (
            <div className={styles.success}>
              <div className={styles.successIcon}><Check size={14} strokeWidth={2} /></div>
              <h2 className={styles.successTitle}>{t.successTitle}</h2>
              <p className={styles.successSub}>{t.successSub}</p>
              <Link href={`/${locale}`} className={styles.backBtn}>{t.backHome}</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              {/* Honeypot — hidden via CSS only, not display:none, to fool bots */}
              <div style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, pointerEvents: "none" }} aria-hidden="true">
                <label htmlFor="_hp">Leave this field blank</label>
                <input id="_hp" type="text" name="_hp" tabIndex={-1} autoComplete="off" value={honeypot} onChange={e => setHoneypot(e.target.value)} />
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>{t.name} <span className={styles.req}>*</span></label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder={t.namePlaceholder}
                    value={form.name}
                    onChange={set("name")}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>{t.contactField} <span className={styles.req}>*</span></label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder={t.contactPlaceholder}
                    value={form.contact}
                    onChange={set("contact")}
                    required
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t.subject} <span className={styles.req}>*</span></label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={t.subjectPlaceholder}
                  value={form.subject}
                  onChange={set("subject")}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t.message} <span className={styles.req}>*</span></label>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  placeholder={t.messagePlaceholder}
                  value={form.message}
                  onChange={set("message")}
                  rows={5}
                  required
                />
              </div>

              <div className={styles.consentGroup}>
                <ConsentCheckbox
                  checked={consent.terms}
                  onChange={(terms) => setConsent((c) => ({ ...c, terms }))}
                  template={t.consentTerms}
                  linkText={t.consentTermsLink}
                  href={`/${locale}/legal`}
                  invalid={consentTouched && !consent.terms}
                />
                <ConsentCheckbox
                  checked={consent.privacy}
                  onChange={(privacy) => setConsent((c) => ({ ...c, privacy }))}
                  template={t.consentPrivacy}
                  linkText={t.consentPrivacyLink}
                  href={`/${locale}/privacy-policy`}
                  invalid={consentTouched && !consent.privacy}
                />
                {consentTouched && !consentGiven && (
                  <p className={styles.consentError} role="alert">
                    {t.consentRequired}
                  </p>
                )}
              </div>

              {needsTurnstile && (
                <Turnstile
                  siteKey={TURNSTILE_SITE_KEY}
                  locale={locale}
                  onToken={setToken}
                  onExpire={() => setToken(null)}
                  onError={() => setToken(null)}
                />
              )}

              {status === "error" && (
                <p className={styles.errorMsg}>{t.error}</p>
              )}

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={!canSubmit}
              >
                {status === "sending"
                  ? t.submitting
                  : needsTurnstile && !token
                    ? t.verifying
                    : t.submit}
              </button>
            </form>
          )}
        </div>
      </div>

    </div>
  );
}
