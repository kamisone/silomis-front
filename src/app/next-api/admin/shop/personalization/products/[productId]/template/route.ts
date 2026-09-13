import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ productId: string }> }) => {
  const { productId } = await params;
  return proxyRequest(req, "PATCH", `/admin/shop/personalization/products/${productId}/template`);
};
