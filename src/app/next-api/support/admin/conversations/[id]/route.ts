import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return proxyRequest(req, "GET", `/support/admin/conversations/${id}`);
};

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return proxyRequest(req, "DELETE", `/support/admin/conversations/${id}`);
};
