import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ provider: string }> }) => {
  const { provider } = await params;
  return proxyRequest(req, "GET", `/admin/integration-credentials/${provider}`);
};

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ provider: string }> }) => {
  const { provider } = await params;
  return proxyRequest(req, "PUT", `/admin/integration-credentials/${provider}`);
};

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ provider: string }> }) => {
  const { provider } = await params;
  return proxyRequest(req, "DELETE", `/admin/integration-credentials/${provider}`);
};
