import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ token: string; itemId: string }> }) => {
  const { token, itemId } = await params;
  return proxyRequest(req, "PUT", `/shop/cart/${token}/items/${itemId}`, { auth: false });
};

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ token: string; itemId: string }> }) => {
  const { token, itemId } = await params;
  return proxyRequest(req, "DELETE", `/shop/cart/${token}/items/${itemId}`, { auth: false });
};
