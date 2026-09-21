import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";
import { readOrderGrant } from "@/lib/shop/orderGrant";

/**
 * A short-lived socket ticket for the order's thread.
 *
 * The grant never leaves this process: it goes out as a header to the API and
 * what comes back is a ticket that expires in minutes. The browser holds the
 * ticket, never the credential behind it.
 */
export const POST = async (req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) => {
  const { orderNumber } = await params;
  const grant = readOrderGrant(req, orderNumber);
  return proxyRequest(req, "POST", `/shop/orders/${encodeURIComponent(orderNumber)}/conversation/ws-ticket`, {
    auth: false,
    extraHeaders: grant ? { "x-order-grant": grant } : {},
  });
};
