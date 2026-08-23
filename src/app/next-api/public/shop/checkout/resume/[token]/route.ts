import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  return proxyRequest(req, "GET", `/shop/checkout/resume/${token}`, { auth: false });
};
