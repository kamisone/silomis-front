import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ productId: string }> }) => {
  const { productId } = await params;
  return proxyRequest(req, "DELETE", `/public/shop/wishlist/${productId}`, { auth: false });
};
