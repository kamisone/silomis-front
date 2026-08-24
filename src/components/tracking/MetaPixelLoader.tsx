"use client";

// Mount only under the storefront layout (inside CookieConsentProvider).
// Never mount under app/admin/** — the pixel must never be present on
// backoffice pages.

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCookieConsent } from "@/components/consent/CookieConsentContext";
import { initFbq, pixelTrack } from "@/lib/metaPixel";

interface Props {
  pixelId: string | null;
  enabled: boolean;
}

export default function MetaPixelLoader({ pixelId, enabled }: Props) {
  const { consent } = useCookieConsent();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loadedRef = useRef(false);

  const canFire = enabled && !!pixelId && consent?.marketing === true;

  // Load the base pixel code exactly once, only after marketing consent is granted.
  // Before that: no script tag is injected, nothing is observable on the page.
  useEffect(() => {
    if (!canFire || loadedRef.current) return;
    initFbq(pixelId!);
    loadedRef.current = true;
  }, [canFire, pixelId]);

  // Fire PageView on every route change — the App Router doesn't reload on
  // navigation, so the base code's own automatic PageView only covers first paint.
  useEffect(() => {
    if (!canFire || !loadedRef.current) return;
    pixelTrack("PageView");
     
  }, [canFire, pathname, searchParams]);

  // Note: if consent is withdrawn mid-session, fbq itself has no supported "hard
  // uninit" — canFire simply becomes false again, so no further pixelTrack calls
  // fire anywhere in the app (every call site guards on window.fbq via pixelTrack's
  // own no-op check). This is the correct, honest interpretation of withdrawal: no
  // new events are sent, though the base script already loaded in this tab stays
  // loaded until the next full page load.

  return null;
}
