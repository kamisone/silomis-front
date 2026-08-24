import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  return proxyRequest(req, "GET", `/shop/products/${slug}/variants/availability`, { auth: false });
};
