import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) => {
  const { id, linkId } = await params;
  return proxyRequest(req, "DELETE", `/admin/shop/promotions/${id}/product-links/${linkId}`);
};
