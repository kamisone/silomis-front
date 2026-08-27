"use client";

import { useEffect, useRef } from "react";
import { useCookieConsent } from "@/components/consent/CookieConsentContext";

interface Props {
  productId: string;
  /** Server-resolved — this component still no-ops without it as defense in depth. */
  isTestProduct: boolean;
}

/**
 * Starts the session-replay recorder on a test-product landing page. Scoped to
 * test products only (the backend independently re-verifies the product before
 * it ever returns a session id, so a stale or forged client claim can't start a
 * recording of a real product) — a deliberate privacy-minimisation choice: test
 * products can't be purchased and draw a small, controlled audience, unlike
 * ordinary shoppers moving through checkout with real PII on-screen.
 *
 * Gated on analytics consent, same pattern as MetaPixelLoader/TikTokPixelLoader:
 * nothing starts — not even the rrweb bundle, which is imported lazily below —
 * before consent is granted. This matters more here than for a pixel: the
 * recorder follows the visitor into checkout, so an ungated one would capture
 * the shipping form.
 *
 * Deliberately does NOT stop the recording on unmount. The recorder is a
 * module-level singleton (see replayRecorder.ts) attached to `document`/
 * `window`, not to this component — a client-side navigation away from the
 * product page (e.g. to the checkout, so that page is captured too) or a
 * consent-state change both unmount/re-run this component, but neither should
 * end an in-flight recording. It only ends on the recorder's own
 * tab-close/hidden signals.
 */
export default function ReplayRecorderMount({ productId, isTestProduct }: Props) {
  const { consent } = useCookieConsent();
  const startedRef = useRef(false);

  const canRecord = isTestProduct && consent?.analytics === true;

  useEffect(() => {
    if (!canRecord || startedRef.current) return;
    startedRef.current = true;
    void import("@/lib/shop/replayRecorder").then(({ startReplayRecording }) => startReplayRecording(productId));
  }, [canRecord, productId]);

  return null;
}
