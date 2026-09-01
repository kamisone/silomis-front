"use client";

import { Suspense, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock, MailCheck, ShieldCheck } from "lucide-react";
import styles from "./page.module.css";

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
          <Image src="/assets/logo_silomis_icon.png" alt="" width={46} height={28} priority />
          <span className={styles.brandWordmark}>
            <span className={styles.brandInitial}>S</span>ilomis
          </span>
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

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

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
        setChallenge(data as MfaChallenge);
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
            <Image src="/assets/logo_silomis_icon.png" alt="Silomis" width={34} height={25} priority />
          </div>

          {challenge ? (
            <>
              <span className={styles.eyebrow}>
                <MailCheck size={13} strokeWidth={2.3} aria-hidden="true" />
                Two-factor
              </span>
              <h1 className={styles.title}>Verify it&apos;s you</h1>
              <p className={styles.subtitle}>
                We sent a {OTP_LENGTH}-digit code to <strong>{challenge.maskedDestination}</strong>.
              </p>

              {error && <ErrorNote message={error} />}

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

              <button
                type="button"
                className={styles.backLink}
                onClick={() => {
                  setChallenge(null);
                  setOtp("");
                  setError(null);
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
