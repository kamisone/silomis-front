import { getTrafficSource } from "./trafficSource";

// Sent so a product view joins the same visitor trail as their cart and
// checkout events (and the replay session list's per-row activity).
function getCartToken(): string | null {
  try {
    return localStorage.getItem("shop_cart_token");
  } catch {
    return null;
  }
}

function post(body: Record<string, unknown>): void {
  fetch("/next-api/public/shop/behavior/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, cartToken: getCartToken(), ...getTrafficSource() }),
  }).catch(() => {});
}

export function trackProductView(productId: string): void {
  post({ eventType: "product_view", productId });
}

export function trackSearch(searchQuery: string, resultCount: number): void {
  post({ eventType: "search", searchQuery, resultCount });
}
