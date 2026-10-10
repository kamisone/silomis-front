import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/** The product's variation options a position photo can be tied to. */
export const GET = async (req: NextRequest, { params }: { params: Promise<{ productId: string }> }) => {
  const { productId } = await params;
  return proxyRequest(req, "GET", `/admin/shop/personalization/products/${productId}/placement-options`);
};
