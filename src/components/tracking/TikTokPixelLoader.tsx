"use client";

// Mount only under the storefront layout (inside CookieConsentProvider).
// Never mount under app/admin/** — the pixel must never be present on
// backoffice pages. Mirrors MetaPixelLoader.tsx exactly.

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCookieConsent } from "@/components/consent/CookieConsentContext";
import { initTtq, ttqTrack } from "@/lib/tiktokPixel";

interface Props {
  pixelId: string | null;
  enabled: boolean;
}

export default function TikTokPixelLoader({ pixelId, enabled }: Props) {
  const { consent } = useCookieConsent();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loadedRef = useRef(false);

  const canFire = enabled && !!pixelId && consent?.marketing === true;

  // Load the base pixel code exactly once, only after marketing consent is
  // granted. Before that: no script tag is injected, nothing is observable
  // on the page. initTtq also fires the first page-view internally (ttq.page()).
  useEffect(() => {
    if (!canFire || loadedRef.current) return;
    initTtq(pixelId!);
    loadedRef.current = true;
  }, [canFire, pixelId]);

  // Fire page view on every subsequent route change — the App Router doesn't
  // reload on navigation, so the base code's own automatic page view only
  // covers first paint.
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (!canFire || !loadedRef.current) return;
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    ttqTrack("PageView");
     
  }, [canFire, pathname, searchParams]);

  // Note: if consent is withdrawn mid-session, ttq itself has no supported
  // "hard uninit" — canFire simply becomes false again, so no further
  // ttqTrack calls fire anywhere in the app (every call site guards on
  // window.ttq via ttqTrack's own no-op check).

  return null;
}
