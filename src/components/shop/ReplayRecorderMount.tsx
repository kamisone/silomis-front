"use client";

import { useEffect } from "react";

/**
 * Mounted only on test-product pages (see ShopProductDetail — `product.isTestProduct`
 * gates this component's presence at all, and the backend independently
 * re-verifies the product is a test product before it ever returns a session
 * id, so a stale/forged client claim can't start a recording of a real product).
 */
export default function ReplayRecorderMount({ productId }: { productId: string }) {
  useEffect(() => {
    let cancelled = false;
    import("@/lib/shop/replayRecorder").then(({ startReplayRecording }) => {
      if (!cancelled) startReplayRecording(productId);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return null;
}
