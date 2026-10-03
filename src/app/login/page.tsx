"use client";

import { Suspense, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock, MailCheck, MessageSquare, RefreshCw, ShieldCheck } from "lucide-react";
import styles from "./page.module.css";

type MfaMethod = "email" | "sms";

/** What each method is called where an admin has to choose between them. */
const METHOD_LABEL: Record<MfaMethod, string> = { email: "email", sms: "SMS" };

interface MfaChallenge {
  mfaRequired: true;
  challengeToken: string;
  availableMethods: Array<"email" | "sms">;
  preferredMethod: "email" | "sms";
  maskedDestination: string;
}

const OTP_LENGTH = 6;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

/**
 * The brand half of the split: charcoal, the way the admin sidebar is, so
 * signing in feels like the front door to the panel behind it rather than a
 * detached form. Hidden on phones, where it would push the form below the fold.
 */
function BrandPanel() {
  return (
    <aside className={styles.brand} aria-hidden="true">
      <div className={styles.brandGlow} />
      <div className={styles.brandInner}>
        <div className={styles.brandLogo}>
          {/* No S: the mark to its left is the S. The whole panel is already
              aria-hidden, so there is nothing to restate for a screen reader. */}
          <Image src="/assets/logo_silomis_mark.webp" alt="" width={34} height={40} priority />
          <span className={styles.brandWordmark}>ilomis</span>
        </div>

        {/* Headline, lede and the two reassurances read as one statement, so they
            are one block — spread across the full height they became three
            unrelated things floating in a lot of charcoal. */}
        <div className={styles.brandCopy}>
          <h2 className={styles.brandHeadline}>
            The control room
            <br />
            for your store.
          </h2>
          <p className={styles.brandLede}>
            Catalogue, orders, customers and content — everything that runs Silomis, behind one sign-in.
          </p>

          <ul className={styles.brandPoints}>
            <li>
              <ShieldCheck size={16} strokeWidth={2.1} aria-hidden="true" />
              Two-factor verification on every account
            </li>
            <li>
              <Lock size={16} strokeWidth={2.1} aria-hidden="true" />
              Encrypted session, signed out automatically
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className={styles.error} role="alert">
      <AlertCircle size={15} strokeWidth={2.2} aria-hidden="true" />
      {message}
    </p>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /**
   * Which method the code in front of the admin was sent by.
   *
   * Starts as the one their account prefers — set in admin under Two-factor —
   * and changes only when they ask for the other. Tracked separately from the
   * challenge because the challenge token does not change when the code is
   * re-sent; only the destination does.
   */
  const [sentBy, setSentBy] = useState<MfaMethod>("email");
  const [sending, setSending] = useState(false);
  /** Set after a successful send, so the admin sees that something happened. */
  const [sentNote, setSentNote] = useState<string | null>(null);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  /**
   * Sends the code again, by `method` or by the same one as before.
   *
   * The challenge token does not change: this is another code against the same
   * challenge, which is why the OTP boxes are cleared rather than the step being
   * restarted. The backend owns the cooldown and whether the method is even
   * available for this admin — a phone-less account asking for SMS gets a
   * refusal, which is shown as it comes back rather than guessed at here.
   */
  async function sendAgain(method?: MfaMethod) {
    if (!challenge || sending) return;
    setSending(true);
    setError(null);
    setSentNote(null);
    try {
      const res = await fetch("/next-api/auth/mfa/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken: challenge.challengeToken, ...(method ? { method } : {}) }),
      });
      const data = (await res.json()) as { maskedDestination?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send a new code.");
        return;
      }
      if (data.maskedDestination) {
        setChallenge({ ...challenge, maskedDestination: data.maskedDestination });
      }
      if (method) setSentBy(method);
      // The old code is still valid until it expires, so the boxes are cleared:
      // typing the previous one into them would fail and read as a bug.
      setOtp("");
      setSentNote(`A new code is on its way by ${METHOD_LABEL[method ?? sentBy]}.`);
      otpRefs.current[0]?.focus();
    } catch {
      setError("Unable to reach the authentication server.");
    } finally {
      setSending(false);
    }
  }

  function redirectAfterLogin() {
    const from = searchParams.get("from");
    router.replace(from && from.startsWith("/") && !from.startsWith("//") ? from : "/admin");
    router.refresh();
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/next-api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error === "rate_limited" ? "Too many attempts. Please wait a few minutes." : "Invalid email or password.");
        return;
      }
      if (data.mfaRequired) {
        // The first code box takes focus via `autoFocus` when it mounts —
        // focusing it from here fired before React had committed the new step,
        // which left the row unfocused and the first keystrokes going nowhere.
        const next = data as MfaChallenge;
        setChallenge(next);
        // The backend has already sent the code by the admin's preferred method;
        // this records which so the switcher can offer the other one.
        setSentBy(next.preferredMethod);
        return;
      }
      redirectAfterLogin();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/next-api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken: challenge.challengeToken, otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
        return;
      }
      redirectAfterLogin();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── One-time code: six boxes rather than one long field ────────────────────
  // The code arrives as six digits, so it is entered as six digits. Typing
  // advances, backspace retreats, and a pasted code fills the row — the three
  // things that make a segmented input pleasant rather than fiddly.

  function setOtpDigit(index: number, digit: string) {
    const next = otp.padEnd(OTP_LENGTH, " ").split("");
    next[index] = digit || " ";
    setOtp(next.join("").trimEnd());
  }

  function onOtpChange(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setOtpDigit(index, "");
      return;
    }
    // Typing into a filled box replaces it; the last character is the intent.
    setOtpDigit(index, digits[digits.length - 1]);
    if (index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  }

  function onOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      e.preventDefault();
      setOtpDigit(index - 1, "");
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  }

  function onOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!digits) return;
    e.preventDefault();
    setOtp(digits);
    otpRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  }

  const otpComplete = otp.replace(/\s/g, "").length === OTP_LENGTH;

  return (
    <div className={styles.page}>
      <BrandPanel />

      <main className={styles.panel}>
        <div className={styles.form}>
          {/* Phones lose the brand panel, so the mark comes back here — a
              sign-in with no logo on it is the one thing that reads as a phish. */}
          <div className={styles.compactBrand}>
            <Image src="/assets/logo_silomis_mark.webp" alt="Silomis" width={21} height={25} priority />
          </div>

          {challenge ? (
            <>
              <span className={styles.eyebrow}>
                {sentBy === "sms" ? (
                  <MessageSquare size={13} strokeWidth={2.3} aria-hidden="true" />
                ) : (
                  <MailCheck size={13} strokeWidth={2.3} aria-hidden="true" />
                )}
                Two-factor
              </span>
              <h1 className={styles.title}>Verify it&apos;s you</h1>
              <p className={styles.subtitle}>
                We sent a {OTP_LENGTH}-digit code by {METHOD_LABEL[sentBy]} to{" "}
                <strong>{challenge.maskedDestination}</strong>.
              </p>

              {error && <ErrorNote message={error} />}
              {!error && sentNote && <p className={styles.sentNote}>{sentNote}</p>}

              <form onSubmit={handleOtpSubmit} noValidate>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="otp-0">
                    Verification code
                  </label>
                  <div className={styles.otpRow}>
                    {Array.from({ length: OTP_LENGTH }, (_, i) => (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        ref={(el) => {
                          otpRefs.current[i] = el;
                        }}
                        className={styles.otpBox}
                        inputMode="numeric"
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        autoFocus={i === 0}
                        maxLength={1}
                        value={otp[i]?.trim() ?? ""}
                        onChange={(e) => onOtpChange(i, e.target.value)}
                        onKeyDown={(e) => onOtpKeyDown(i, e)}
                        onPaste={onOtpPaste}
                        aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
                      />
                    ))}
                  </div>
                </div>

                <button type="submit" className={styles.submit} disabled={loading || !otpComplete}>
                  {loading ? (
                    <>
                      <Loader2 size={16} strokeWidth={2.4} className={styles.spin} aria-hidden="true" />
                      Verifying…
                    </>
                  ) : (
                    "Verify and continue"
                  )}
                </button>
              </form>

              {/* Didn't arrive, or arrived somewhere they cannot reach.
                  Without these two an admin whose code is delayed has no way
                  forward at all — the only option was to start the sign-in
                  again, which issues a new challenge and does not help if the
                  problem is the channel rather than the code. */}
              <div className={styles.otpActions}>
                <button
                  type="button"
                  className={styles.otpAction}
                  onClick={() => void sendAgain()}
                  disabled={sending}
                >
                  {sending ? (
                    <Loader2 size={13} strokeWidth={2.3} className={styles.spin} aria-hidden="true" />
                  ) : (
                    <RefreshCw size={13} strokeWidth={2.3} aria-hidden="true" />
                  )}
                  Send a new code
                </button>

                {/* Only when the account actually has the other method. An
                    admin with no phone number is never offered SMS, because
                    the backend would refuse it and the offer would be a dead
                    end wearing the clothes of a solution. */}
                {challenge.availableMethods
                  .filter((m) => m !== sentBy)
                  .map((other) => (
                    <button
                      key={other}
                      type="button"
                      className={styles.otpAction}
                      onClick={() => void sendAgain(other)}
                      disabled={sending}
                    >
                      {other === "sms" ? (
                        <MessageSquare size={13} strokeWidth={2.3} aria-hidden="true" />
                      ) : (
                        <MailCheck size={13} strokeWidth={2.3} aria-hidden="true" />
                      )}
                      Send by {METHOD_LABEL[other]} instead
                    </button>
                  ))}
              </div>

              <button
                type="button"
                className={styles.backLink}
                onClick={() => {
                  setChallenge(null);
                  setOtp("");
                  setError(null);
                  setSentNote(null);
                }}
              >
                <ArrowLeft size={14} strokeWidth={2.2} aria-hidden="true" />
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <span className={styles.eyebrow}>
                <Lock size={13} strokeWidth={2.3} aria-hidden="true" />
                Admin panel
              </span>
              <h1 className={styles.title}>Sign in</h1>
              <p className={styles.subtitle}>Use the account your store administrator set up for you.</p>

              {error && <ErrorNote message={error} />}

              <form onSubmit={handlePasswordSubmit} noValidate>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@silomis.com"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="password">
                    Password
                  </label>
                  <div className={styles.inputWrap}>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className={`${styles.input} ${styles.inputWithButton}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className={styles.reveal}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} strokeWidth={2.1} /> : <Eye size={16} strokeWidth={2.1} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className={styles.submit} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 size={16} strokeWidth={2.4} className={styles.spin} aria-hidden="true" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>

              <p className={styles.footnote}>
                <ShieldCheck size={13} strokeWidth={2.2} aria-hidden="true" />
                Protected by two-factor verification
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
