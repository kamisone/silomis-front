import { NextRequest, NextResponse } from "next/server";

/**
 * The customer's proof that an order is theirs, held as an httpOnly cookie.
 *
 * One cookie per order rather than a single cookie holding a map: a shopper
 * can have several orders open, and a map would need a read-modify-write on
 * every issue — two tabs doing that at once lose one of the grants. Separate
 * names cannot collide, and each expires on its own.
 *
 * httpOnly is the point of the whole mechanism. The credential it replaces
 * (`?email=` on the tracking URL) travelled in the address bar, which put it
 * in browser history, in `Referer` headers to every third party the page
 * loads, in access logs, and in this shop's own session replay. A cookie the
 * page's JavaScript cannot read leaks through none of those.
 */

const PREFIX = "silomis_order_";

/**
 * Order numbers are `ORD-000123` (see OrdersService.create), but the value
 * arrives from the URL, so it is normalised rather than trusted: anything
 * outside the safe set would let a crafted path write a cookie of the
 * attacker's choosing.
 */
export function orderGrantCookieName(orderNumber: string): string {
  return `${PREFIX}${orderNumber.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60)}`;
}

export function readOrderGrant(req: NextRequest, orderNumber: string): string | undefined {
  return req.cookies.get(orderGrantCookieName(orderNumber))?.value;
}

export function setOrderGrant(
  res: NextResponse,
  orderNumber: string,
  token: string,
  maxAge: number,
): void {
  res.cookies.set(orderGrantCookieName(orderNumber), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax", matching the admin session cookies: the grant has to survive the
    // top-level navigation that arrives from the link in the order email,
    // which is exactly the case "strict" drops.
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}
