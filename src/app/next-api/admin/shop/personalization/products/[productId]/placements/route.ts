import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ productId: string }> }) => {
  const { productId } = await params;
  return proxyRequest(req, "GET", `/admin/shop/personalization/products/${productId}/placements`);
};

export const POST = async (req: NextRequest, { params }: { params: Promise<{ productId: string }> }) => {
  const { productId } = await params;
  return proxyRequest(req, "POST", `/admin/shop/personalization/products/${productId}/placements`);
};
