import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ id: string; valueId: string }> }) => {
  const { id, valueId } = await params;
  return proxyRequest(req, "PATCH", `/admin/shop/category-filters/${id}/values/${valueId}`);
};

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string; valueId: string }> }) => {
  const { id, valueId } = await params;
  return proxyRequest(req, "DELETE", `/admin/shop/category-filters/${id}/values/${valueId}`);
};
