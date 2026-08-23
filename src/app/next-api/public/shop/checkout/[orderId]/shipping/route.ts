import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) => {
  const { orderId } = await params;
  return proxyRequest(req, "PATCH", `/shop/checkout/${orderId}/shipping`, { auth: false });
};
