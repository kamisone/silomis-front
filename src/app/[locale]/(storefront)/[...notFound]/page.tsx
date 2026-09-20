import { notFound } from "next/navigation";

/**
 * Sends unmatched storefront URLs through the storefront's own 404 boundary.
 *
 * Without this, `/<locale>/anything-unknown` matches no route at all and Next
 * falls all the way back to the *root* `app/not-found.tsx`, which renders
 * outside the commerce layout — no header, no cart, no footer. A catch-all
 * that does nothing but throw `notFound()` keeps the visitor inside the shop
 * while still answering with a real 404 status.
 *
 * Static and dynamic segments both out-rank a catch-all in Next's route
 * matching, so this only ever runs when nothing else matched.
 */
export default function StorefrontCatchAll(): never {
  notFound();
}
