import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ id: string; addressId: string }> }) => {
  const { id, addressId } = await params;
  return proxyRequest(req, "PATCH", `/admin/shop/customers/${id}/addresses/${addressId}`);
};

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string; addressId: string }> }) => {
  const { id, addressId } = await params;
  return proxyRequest(req, "DELETE", `/admin/shop/customers/${id}/addresses/${addressId}`);
};
