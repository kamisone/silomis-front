import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ id: string; optionValueId: string }> }) => {
  const { id, optionValueId } = await params;
  return proxyRequest(req, "PUT", `/admin/shop/products/${id}/option-images/${optionValueId}`);
};

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string; optionValueId: string }> }) => {
  const { id, optionValueId } = await params;
  return proxyRequest(req, "DELETE", `/admin/shop/products/${id}/option-images/${optionValueId}`);
};
