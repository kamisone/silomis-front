import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";
import { readOrderGrant } from "@/lib/shop/orderGrant";

/** The order's conversation so far. 404 unless the visitor holds a `full` grant. */
export const GET = async (req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) => {
  const { orderNumber } = await params;
  const grant = readOrderGrant(req, orderNumber);
  return proxyRequest(req, "GET", `/shop/orders/${encodeURIComponent(orderNumber)}/conversation`, {
    auth: false,
    extraHeaders: grant ? { "x-order-grant": grant } : {},
  });
};
