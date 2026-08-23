import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const POST = async (req: NextRequest, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  return proxyRequest(req, "POST", `/shop/cart/${token}/items`, { auth: false });
};
