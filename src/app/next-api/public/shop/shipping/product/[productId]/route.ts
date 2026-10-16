import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// Per visitor: the backend reads the forwarded client IP. Never cached here.
export const GET = async (req: NextRequest, { params }: { params: Promise<{ productId: string }> }) => {
  const { productId } = await params;
  return proxyRequest(req, "GET", `/public/shop/shipping/product/${encodeURIComponent(productId)}`, { auth: false });
};
