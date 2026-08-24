import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const POST = async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  return proxyRequest(req, "POST", `/shop/products/${slug}/variants/resolve`, { auth: false });
};
