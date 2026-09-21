import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";
import { readOrderGrant } from "@/lib/shop/orderGrant";

/**
 * Sends a message carrying images. Multipart passes through untouched —
 * proxyRequest forwards a FormData body as-is.
 */
export const POST = async (req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) => {
  const { orderNumber } = await params;
  const grant = readOrderGrant(req, orderNumber);
  return proxyRequest(req, "POST", `/shop/orders/${encodeURIComponent(orderNumber)}/conversation/attachments`, {
    auth: false,
    extraHeaders: grant ? { "x-order-grant": grant } : {},
  });
};
