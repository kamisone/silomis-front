import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string; productId: string }> }) => {
  const { id, productId } = await params;
  return proxyRequest(req, "DELETE", `/admin/shop/collections/${id}/products/${productId}`);
};
