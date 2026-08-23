"use client";

import { useEffect, useRef, useState } from "react";
import { getTranslations } from "@/lib/i18n";
import styles from "./NewsletterForm.module.css";

interface Props {
  locale: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterForm({ locale }: Props) {
  const t = getTranslations(locale).newsletter;

  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error" | "invalid">("idle");
  const renderedAt = useRef<number>(0);

  useEffect(() => { renderedAt.current = Date.now(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus("invalid");
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch("/next-api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          locale,
          _hp: honeypot || undefined,
          _t: renderedAt.current || undefined,
        }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return <p className={styles.successMsg}>{t.success}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} aria-label={t.ariaLabel}>
      {/* Honeypot — hidden via inline styles only, not display:none, to fool bots */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, pointerEvents: "none" }} aria-hidden="true">
        <label htmlFor="_hp_newsletter">Leave this field blank</label>
        <input
          id="_hp_newsletter"
          type="text"
          name="_hp"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className={styles.row}>
        <input
          type="email"
          className={styles.input}
          placeholder={t.emailPlaceholder}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "invalid" || status === "error") setStatus("idle");
          }}
          required
        />
        <button type="submit" className={styles.submitBtn} disabled={status === "sending"}>
          {status === "sending" ? t.submitting : t.submit}
        </button>
      </div>

      {status === "invalid" && <p className={styles.errorMsg}>{t.invalidEmail}</p>}
      {status === "error" && <p className={styles.errorMsg}>{t.error}</p>}
    </form>
  );
}
