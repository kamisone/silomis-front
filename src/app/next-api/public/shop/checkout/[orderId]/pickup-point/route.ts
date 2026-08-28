import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) => {
  const { orderId } = await params;
  return proxyRequest(req, "PUT", `/shop/checkout/${orderId}/pickup-point`, { auth: false });
};
