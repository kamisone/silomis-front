import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ variantId: string }> }) => {
  const { variantId } = await params;
  return proxyRequest(req, "GET", `/shop/variants/${variantId}/stock`, { auth: false });
};
