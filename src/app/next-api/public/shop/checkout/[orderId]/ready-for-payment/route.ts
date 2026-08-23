import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const POST = async (req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) => {
  const { orderId } = await params;
  return proxyRequest(req, "POST", `/shop/checkout/${orderId}/ready-for-payment`, { auth: false });
};
