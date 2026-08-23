"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import styles from "./page.module.css";

interface MfaChallenge {
  mfaRequired: true;
  challengeToken: string;
  availableMethods: Array<"email" | "sms">;
  preferredMethod: "email" | "sms";
  maskedDestination: string;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  if (challenge) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Verify it&apos;s you</h1>
          <p className={styles.subtitle}>Enter the 6-digit code sent to {challenge.maskedDestination}</p>
          {error && <p className={styles.error}>{error}</p>}
          <form onSubmit={handleOtpSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="otp">
                Verification code
              </label>
              <input
                id="otp"
                className={styles.otpInput}
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <button type="submit" className={styles.submit} disabled={loading || otp.length !== 6}>
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>
          <div className={styles.hint}>
            <button type="button" className={styles.link} onClick={() => setChallenge(null)}>
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brandRow}>
          <span className={styles.brandMark}>
            <Image src="/assets/logo_silomis_icon.png" alt="" width={30} height={22} />
          </span>
          <h1 className={styles.title}>Silomis</h1>
        </div>
        <p className={styles.subtitle}>Sign in to the admin panel</p>
        {error && <p className={styles.error}>{error}</p>}
        <form onSubmit={handlePasswordSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input id="email" type="email" className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input id="password" type="password" className={styles.input} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
