export const CONSENT_KEY = "silomis_consent";

export interface ConsentState {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
}

export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "analytics" in parsed &&
      "marketing" in parsed &&
      "decidedAt" in parsed
    ) {
      return parsed as ConsentState;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeConsent(state: ConsentState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
}
