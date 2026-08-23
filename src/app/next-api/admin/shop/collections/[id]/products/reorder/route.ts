import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return proxyRequest(req, "PUT", `/admin/shop/collections/${id}/products/reorder`);
};
