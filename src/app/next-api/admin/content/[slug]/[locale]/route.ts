import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ slug: string; locale: string }> }) => {
  const { slug, locale } = await params;
  return proxyRequest(req, "GET", `/admin/content/${slug}/${locale}`);
};

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ slug: string; locale: string }> }) => {
  const { slug, locale } = await params;
  return proxyRequest(req, "PUT", `/admin/content/${slug}/${locale}`);
};
