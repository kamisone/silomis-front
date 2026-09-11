"use client";

import { useEffect, useRef } from "react";
import { useCookieConsent } from "@/components/consent/CookieConsentContext";

interface Props {
  productId: string;
}

/**
 * Starts the session-replay recorder on a product page.
 *
 * Recording used to be limited to test products. It now covers the live
 * catalogue too, because the question it answers — why does paid traffic land
 * on a product page and leave — is asked about real products, and there were
 * no recordings of them at all. The backend decides what is actually recorded:
 * it re-reads the product (a stale or forged client claim starts nothing) and
 * samples live sessions per REPLAY_LIVE_SAMPLE_RATE, so asking to record is
 * not the same as recording.
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
export default function ReplayRecorderMount({ productId }: Props) {
  const { consent } = useCookieConsent();
  const startedRef = useRef(false);

  const canRecord = consent?.analytics === true;

  useEffect(() => {
    if (!canRecord || startedRef.current) return;
    startedRef.current = true;
    void import("@/lib/shop/replayRecorder").then(({ startReplayRecording }) => startReplayRecording(productId));
  }, [canRecord, productId]);

  return null;
}
