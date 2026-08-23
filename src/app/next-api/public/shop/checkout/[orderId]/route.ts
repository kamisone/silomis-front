import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) => {
  const { orderId } = await params;
  return proxyRequest(req, "GET", `/shop/checkout/${orderId}`, { auth: false });
};
