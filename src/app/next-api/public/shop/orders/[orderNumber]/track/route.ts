import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) => {
  const { orderNumber } = await params;
  return proxyRequest(req, "GET", `/shop/orders/${orderNumber}/track`, { auth: false });
};
