function post(body: Record<string, unknown>): void {
  fetch("/next-api/public/shop/behavior/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function trackProductView(productId: string): void {
  post({ eventType: "product_view", productId });
}

export function trackSearch(searchQuery: string, resultCount: number): void {
  post({ eventType: "search", searchQuery, resultCount });
}
