import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ slug: string; variantSlug: string }> }) => {
  const { slug, variantSlug } = await params;
  return proxyRequest(req, "GET", `/shop/products/${slug}/variants/${variantSlug}`, { auth: false });
};
