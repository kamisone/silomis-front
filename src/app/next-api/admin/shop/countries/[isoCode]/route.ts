import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ isoCode: string }> }) => {
  const { isoCode } = await params;
  return proxyRequest(req, "PATCH", `/admin/shop/countries/${isoCode}`);
};

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ isoCode: string }> }) => {
  const { isoCode } = await params;
  return proxyRequest(req, "DELETE", `/admin/shop/countries/${isoCode}`);
};
