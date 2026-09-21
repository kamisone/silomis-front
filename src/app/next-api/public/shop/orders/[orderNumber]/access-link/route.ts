import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";
import { readOrderGrant } from "@/lib/shop/orderGrant";

/**
 * Asks the backend to email the order's secure link to the address on the
 * order. Always answers 204, whatever the outcome — see
 * OrderAccessService.sendAccessLink for why.
 */
export const POST = async (req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) => {
  const { orderNumber } = await params;
  // A visitor who already holds a grant has proved they know the address, so
  // the API can send without them retyping it.
  const grant = readOrderGrant(req, orderNumber);
  return proxyRequest(req, "POST", `/shop/orders/${encodeURIComponent(orderNumber)}/access-link`, {
    auth: false,
    extraHeaders: grant ? { "x-order-grant": grant } : {},
  });
};
