import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ variantId: string }> }) => {
  const { variantId } = await params;
  return proxyRequest(req, "GET", `/admin/shop/inventory/${variantId}`);
};

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ variantId: string }> }) => {
  const { variantId } = await params;
  return proxyRequest(req, "PATCH", `/admin/shop/inventory/${variantId}`);
};
