import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) => {
  const { customerId } = await params;
  return proxyRequest(req, "GET", `/admin/shop/payment-methods/customer/${customerId}`);
};
