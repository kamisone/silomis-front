import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/** An order's thread, for the Messages tab on the admin order page. */
export const GET = async (req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) => {
  const { orderId } = await params;
  return proxyRequest(req, "GET", `/support/admin/orders/${encodeURIComponent(orderId)}/conversation`);
};
