import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/proxy";
import { setOrderGrant } from "@/lib/shop/orderGrant";

interface Grant {
  token: string;
  level: "status" | "full";
  maxAge: number;
  orderNumber: string;
}

/**
 * Exchanges a tracking credential for a grant, and keeps that grant in an
 * httpOnly cookie instead of handing it back to the page.
 *
 * The response body deliberately carries only the level, never the grant
 * itself: the browser gets the capability without the page's JavaScript ever
 * holding it.
 */
export const POST = async (req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) => {
  const { orderNumber } = await params;

  let grant: Grant | null = null;
  const res = await proxyRequest(req, "POST", `/shop/orders/${encodeURIComponent(orderNumber)}/session`, {
    auth: false,
    onSuccess: (body) => {
      grant = body as Grant;
    },
  });

  if (!grant) return res;

  const { token, level, maxAge } = grant as Grant;
  const out = NextResponse.json({ level }, { status: 200 });
  setOrderGrant(out, orderNumber, token, maxAge);
  return out;
};
