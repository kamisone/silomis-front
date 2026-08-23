import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const POST = async (req: NextRequest, { params }: { params: Promise<{ variantId: string }> }) => {
  const { variantId } = await params;
  return proxyRequest(req, "POST", `/admin/shop/inventory/${variantId}/adjust`);
};
