"use client";

import { createContext, useContext } from "react";
import type { ConsentState } from "@/lib/cookieConsent";

export interface CookieConsentContextValue {
  consent: ConsentState | null;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (prefs: { analytics: boolean; marketing: boolean }) => void;
  openSettings: () => void;
}

export const CookieConsentContext =
  createContext<CookieConsentContextValue | null>(null);

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error("useCookieConsent must be used inside CookieConsentProvider");
  }
  return ctx;
}
