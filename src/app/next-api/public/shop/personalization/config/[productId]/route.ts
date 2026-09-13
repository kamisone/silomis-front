import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ productId: string }> }) => {
  const { productId } = await params;
  return proxyRequest(req, "GET", `/shop/personalization/config/${productId}`, { auth: false });
};
