"use client";

import { useCallback, useEffect, useState } from "react";
import { readConsent, writeConsent } from "@/lib/cookieConsent";
import type { ConsentState } from "@/lib/cookieConsent";
import { CookieConsentContext } from "./CookieConsentContext";
import CookieConsentBanner from "./CookieConsentBanner";
import CookiePreferencesModal from "./CookiePreferencesModal";

interface Props {
  locale: string;
  children: React.ReactNode;
}

export default function CookieConsentProvider({ locale, children }: Props) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const stored = readConsent();
      setConsent(stored);
      setBannerVisible(stored === null);
      setHydrated(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const persistAndClose = useCallback((state: ConsentState) => {
    writeConsent(state);
    setConsent(state);
    setBannerVisible(false);
    setModalOpen(false);
  }, []);

  const acceptAll = useCallback(() => {
    persistAndClose({
      essential: true,
      analytics: true,
      marketing: true,
      decidedAt: new Date().toISOString(),
    });
  }, [persistAndClose]);

  const rejectAll = useCallback(() => {
    persistAndClose({
      essential: true,
      analytics: false,
      marketing: false,
      decidedAt: new Date().toISOString(),
    });
  }, [persistAndClose]);

  const savePreferences = useCallback(
    (prefs: { analytics: boolean; marketing: boolean }) => {
      persistAndClose({
        essential: true,
        analytics: prefs.analytics,
        marketing: prefs.marketing,
        decidedAt: new Date().toISOString(),
      });
    },
    [persistAndClose]
  );

  const openSettings = useCallback(() => {
    setModalOpen(true);
  }, []);

  return (
    <CookieConsentContext.Provider
      value={{ consent, acceptAll, rejectAll, savePreferences, openSettings }}
    >
      {children}
      {hydrated && bannerVisible && !modalOpen && (
        <CookieConsentBanner
          locale={locale}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onCustomize={() => setModalOpen(true)}
        />
      )}
      {hydrated && modalOpen && (
        <CookiePreferencesModal
          locale={locale}
          initialPrefs={{
            analytics: consent?.analytics ?? false,
            marketing: consent?.marketing ?? false,
          }}
          onSave={savePreferences}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onClose={() => setModalOpen(false)}
        />
      )}
    </CookieConsentContext.Provider>
  );
}
