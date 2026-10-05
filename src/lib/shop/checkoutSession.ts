/**
 * The checkout keeps its progress in sessionStorage under `checkout:<cartToken>`
 * (see shop/checkout/page.tsx), including the draft order it created at the
 * address step. That order is a copy of the basket at that moment.
 *
 * Once the basket changes — a line personalised from the cart, a quantity
 * changed — the copy is stale, and resuming it at the shipping or payment step
 * would charge for, and produce, the old basket. This drops the order and its
 * payment state and sends the checkout back to the address step, where
 * submitting rebuilds the order from the cart. The address the customer typed
 * is kept.
 */
export function invalidateCheckoutOrder(cartToken: string | null): void {
  if (!cartToken) return;
  try {
    const key = `checkout:${cartToken}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    const saved = JSON.parse(raw) as { step?: string; snapshot?: unknown; selectedMethodId?: unknown; clientSecret?: unknown };
    if (!saved.snapshot && saved.step !== "shipping" && saved.step !== "payment") return;
    sessionStorage.setItem(
      key,
      JSON.stringify({
        ...saved,
        step: saved.step === "shipping" || saved.step === "payment" ? "address" : saved.step,
        snapshot: null,
        selectedMethodId: null,
        clientSecret: null,
      }),
    );
  } catch {
    // Storage unavailable — nothing was resumable either.
  }
}
