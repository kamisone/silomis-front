/**
 * Machine-readable codes from the backend, mapped to safe user-facing messages.
 *
 * Shared by every MFA route so the two paths — verify and send — cannot drift
 * into describing the same failure differently. Nothing from the backend's raw
 * `message` field is ever forwarded to the browser: an authentication error is
 * exactly where a leaked internal detail is worth most to an attacker.
 */
export const MFA_ERROR_MESSAGES: Record<string, string> = {
  otp_expired: "Verification code expired. Request a new one.",
  otp_invalid: "Invalid code. Check the digits and try again.",
  challenge_invalid: "Unable to verify your authentication request.",
  rate_limited: "Too many attempts. Please wait a few minutes.",
  cooldown: "Please wait a moment before requesting another code.",
  method_unavailable: "This verification method is not available for your account.",
};

export function safeMfaError(body: unknown, status: number): string {
  const code =
    typeof body === "object" && body !== null
      ? ((body as Record<string, unknown>).code as string | undefined)
      : undefined;
  if (code && MFA_ERROR_MESSAGES[code]) return MFA_ERROR_MESSAGES[code];
  if (status === 429) return MFA_ERROR_MESSAGES.rate_limited;
  if (status === 401) return MFA_ERROR_MESSAGES.challenge_invalid;
  return "Authentication failed. Please try again.";
}
