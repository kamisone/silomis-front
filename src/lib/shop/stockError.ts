/**
 * Shared stock/inventory error utilities for the shop.
 *
 * Backend emits: BadRequestException({ code: 'INSUFFICIENT_STOCK', available: N })
 * NestJS serialises this as: { statusCode: 400, message: { code, available }, error: 'Bad Request' }
 */

import type { Translations } from "@/lib/i18n/translations";

export const STOCK_ERROR_CODE = {
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  PRODUCT_UNAVAILABLE: "PRODUCT_UNAVAILABLE",
  UNKNOWN: "UNKNOWN",
} as const;

export type StockErrorCode = (typeof STOCK_ERROR_CODE)[keyof typeof STOCK_ERROR_CODE];

export interface StockApiError {
  code: StockErrorCode;
  available?: number;
}

/** Result returned by CartContext.addItem / updateItem. */
export interface CartMutationResult {
  ok: boolean;
  code?: StockErrorCode;
  available?: number;
}

/**
 * Parses a raw NestJS response body into a typed StockApiError.
 * Handles both the structured { message: { code, available } } shape
 * and flat { code, available } bodies.
 */
export function parseApiError(body: unknown): StockApiError {
  if (!body || typeof body !== "object") return { code: STOCK_ERROR_CODE.UNKNOWN };
  const b = body as Record<string, unknown>;
  const payload = typeof b.message === "object" && b.message !== null ? (b.message as Record<string, unknown>) : b;
  const code = (typeof payload.code === "string" ? payload.code : STOCK_ERROR_CODE.UNKNOWN) as StockErrorCode;
  const available = typeof payload.available === "number" ? payload.available : undefined;
  return { code, available };
}

/** Formats a cart error or stock error into a user-facing string. */
export function formatStockError(err: { code?: StockErrorCode; available?: number }, t: Translations): string {
  if (err.code === STOCK_ERROR_CODE.INSUFFICIENT_STOCK) {
    if (typeof err.available === "number") {
      return err.available === 0 ? t.shop.outOfStockError : t.shop.stockOnlyN.replace("{n}", String(err.available));
    }
    return t.shop.insufficientStock;
  }
  if (err.code === STOCK_ERROR_CODE.PRODUCT_UNAVAILABLE) return t.shop.productUnavailableError;
  return t.shop.cartAddError;
}

/**
 * Computes the message for a proactive GET …/stock check.
 * Returns null when the requested quantity is acceptable (no error).
 */
export function stockCheckMessage(available: number, requestedQty: number, t: Translations): string | null {
  if (available === -1) return null; // untracked inventory — always OK
  if (available === 0) return t.shop.outOfStockError;
  if (requestedQty > available) return t.shop.stockOnlyN.replace("{n}", String(available));
  return null;
}
