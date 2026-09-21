import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/** The shop's reply, carrying images. */
export const POST = async (req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) => {
  const { orderId } = await params;
  return proxyRequest(req, "POST", `/support/admin/orders/${encodeURIComponent(orderId)}/attachments`);
};
