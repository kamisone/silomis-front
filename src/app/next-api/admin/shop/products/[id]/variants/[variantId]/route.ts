import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ id: string; variantId: string }> }) => {
  const { id, variantId } = await params;
  return proxyRequest(req, "PATCH", `/admin/shop/products/${id}/variants/${variantId}`);
};

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string; variantId: string }> }) => {
  const { id, variantId } = await params;
  return proxyRequest(req, "DELETE", `/admin/shop/products/${id}/variants/${variantId}`);
};
