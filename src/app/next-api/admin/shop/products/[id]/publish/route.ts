import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const POST = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return proxyRequest(req, "POST", `/admin/shop/products/${id}/publish`);
};
