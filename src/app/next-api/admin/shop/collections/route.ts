import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/admin/shop/collections");
export const POST = (req: NextRequest) => proxyRequest(req, "POST", "/admin/shop/collections");
