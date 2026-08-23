"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const SESSION_TOKEN_KEY = "shop_wishlist_session_token";

export interface WishlistItem {
  id: string;
  productId: string;
  variantId: string | null;
  addedAt: string;
}

interface WishlistContextValue {
  items: WishlistItem[];
  loading: boolean;
  isWishlisted: (productId: string) => boolean;
  toggle: (productId: string, variantId?: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

function getSessionToken(): string {
  let token = localStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  return token;
}

/**
 * Unlike the reference project's frontend, this treats the backend as the
 * source of truth (fetches on mount, updates from server responses) rather
 * than mirroring state in localStorage — the reference's UI never even calls
 * GET, so a wishlist "worked" only as an illusion of that one browser tab.
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sessionToken = getSessionToken();
      const res = await fetch(`/next-api/public/shop/wishlist?sessionToken=${encodeURIComponent(sessionToken)}`, { cache: "no-store" });
      if (res.ok) setItems(await res.json());
    } catch {
      // Network failure — keep whatever state we already have rather than clearing it.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const isWishlisted = useCallback((productId: string) => items.some((i) => i.productId === productId), [items]);

  const toggle = useCallback(
    async (productId: string, variantId?: string) => {
      const sessionToken = getSessionToken();
      const already = items.some((i) => i.productId === productId);
      try {
        if (already) {
          await fetch(`/next-api/public/shop/wishlist/${productId}?sessionToken=${encodeURIComponent(sessionToken)}`, { method: "DELETE" });
          setItems((prev) => prev.filter((i) => i.productId !== productId));
        } else {
          const res = await fetch("/next-api/public/shop/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionToken, productId, variantId }),
          });
          if (res.ok) {
            const created = await res.json();
            setItems((prev) => [...prev, created]);
          }
        }
      } catch {
        // Leave state as-is on failure — a retried toggle will reconcile on next load().
      }
    },
    [items],
  );

  return <WishlistContext.Provider value={{ items, loading, isWishlisted, toggle }}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
}
