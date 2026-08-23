import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return proxyRequest(req, "PATCH", `/admin/shop/shipping/zones/${id}`);
};

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return proxyRequest(req, "DELETE", `/admin/shop/shipping/zones/${id}`);
};
