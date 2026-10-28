"use client";

import { useSyncExternalStore } from "react";
import { storeBrandSnapshot, subscribeStoreBrand, type StoreBrandChrome } from "./storeBrand";

/**
 * The neutral brand shown on this page (lib/shop/storeBrand.ts), or null for
 * Silomis. Null on the server and in the first client render, so hydration
 * matches. Its own client module: storeBrand.ts is also read by the server
 * layout, for the inline script's storage key.
 */
export function useStoreBrand(): StoreBrandChrome | null {
  return useSyncExternalStore(subscribeStoreBrand, storeBrandSnapshot, () => null);
}
