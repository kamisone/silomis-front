"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { parseApiError, type CartMutationResult } from "@/lib/shop/stockError";

export interface CartItemOption {
  attributeId: string;
  attributeName: string;
  optionValueId: string | null;
  value: string;
  displayValue: string | null;
}

export interface CartItem {
  id: string;
  variantId: string;
  productId: string;
  productSlug: string | null;
  titleSnapshot: string;
  skuSnapshot: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  /** This product carries free delivery; one such item frees the whole basket. */
  freeShipping?: boolean;
  optionsSnapshot: CartItemOption[] | null;
  compareAtPriceCentsSnapshot?: number | null;
}

export interface Cart {
  id: string | null;
  token: string;
  status: string;
  items: CartItem[];
  subtotalCents: number;
  itemCount: number;
  /** At least one item ships free, so the order does. Set by the backend. */
  freeShipping?: boolean;
}

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  mutating: boolean;
  addItem: (variantId: string, quantity?: number, selectedOptionValueIds?: string[]) => Promise<CartMutationResult>;
  updateItem: (itemId: string, quantity: number) => Promise<CartMutationResult>;
  removeItem: (itemId: string) => Promise<void>;
  token: string;
  refresh: () => Promise<void>;
  clearCart: () => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function getOrCreateToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem("shop_cart_token");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("shop_cart_token", token);
  }
  return token;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return getOrCreateToken();
  });
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Always-current cart ref for optimistic rollback without stale closures
  const cartRef = useRef<Cart | null>(null);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  function applyCart(data: Cart) {
    if (data.token && data.token !== token) {
      localStorage.setItem("shop_cart_token", data.token);
      setToken(data.token);
    }
    setCart(data);
  }

  const fetchCart = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/next-api/public/shop/cart/${token}`);
      if (res.ok) applyCart(await res.json());
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => fetchCart(), 0);
    return () => clearTimeout(t);
  }, [token, fetchCart]);

  const addItem = useCallback(
    async (variantId: string, quantity = 1, selectedOptionValueIds?: string[]): Promise<CartMutationResult> => {
      setMutating(true);
      try {
        const res = await fetch(`/next-api/public/shop/cart/${token}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId, quantity, selectedOptionValueIds }),
        });
        if (res.ok) {
          const data: Cart = await res.json();
          applyCart(data);
          return { ok: true };
        }
        const body = await res.json().catch(() => ({}));
        const { code, available } = parseApiError(body);
        return { ok: false, code, available };
      } catch {
        return { ok: false };
      } finally {
        setMutating(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [token],
  );

  const updateItem = useCallback(
    async (itemId: string, quantity: number): Promise<CartMutationResult> => {
      const prevCart = cartRef.current;

      // Optimistic update
      setCart((current) => {
        if (!current) return current;
        const item = current.items.find((i) => i.id === itemId);
        if (!item) return current;
        const newLineTotal = item.unitPriceCents * quantity;
        return {
          ...current,
          items: current.items.map((i) => (i.id === itemId ? { ...i, quantity, lineTotalCents: newLineTotal } : i)),
          itemCount: current.itemCount + (quantity - item.quantity),
          subtotalCents: current.subtotalCents + (newLineTotal - item.lineTotalCents),
        };
      });

      setMutating(true);
      try {
        const res = await fetch(`/next-api/public/shop/cart/${token}/items/${itemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity }),
        });
        if (res.ok) {
          applyCart(await res.json());
          return { ok: true };
        }
        setCart(prevCart);
        const body = await res.json().catch(() => ({}));
        const { code, available } = parseApiError(body);
        return { ok: false, code, available };
      } catch {
        setCart(prevCart);
        return { ok: false };
      } finally {
        setMutating(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [token],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      const prevCart = cartRef.current;

      // Optimistic update
      setCart((current) => {
        if (!current) return current;
        const item = current.items.find((i) => i.id === itemId);
        if (!item) return current;
        return {
          ...current,
          items: current.items.filter((i) => i.id !== itemId),
          itemCount: current.itemCount - item.quantity,
          subtotalCents: current.subtotalCents - item.lineTotalCents,
        };
      });

      setMutating(true);
      try {
        const res = await fetch(`/next-api/public/shop/cart/${token}/items/${itemId}`, {
          method: "DELETE",
        });
        if (res.ok) applyCart(await res.json());
        else setCart(prevCart);
      } catch {
        setCart(prevCart);
      } finally {
        setMutating(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [token],
  );

  const clearCart = useCallback(() => {
    const newToken = crypto.randomUUID();
    localStorage.setItem("shop_cart_token", newToken);
    setToken(newToken);
    setCart(null);
  }, []);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        mutating,
        addItem,
        updateItem,
        removeItem,
        token,
        refresh: fetchCart,
        clearCart,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
