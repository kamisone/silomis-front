import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const POST = async (req: NextRequest, { params }: { params: Promise<{ productId: string }> }) => {
  const { productId } = await params;
  return proxyRequest(req, "POST", `/shop/personalization/quote/${productId}`, { auth: false });
};
