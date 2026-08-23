import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/admin/shop/variant-attributes");
export const POST = (req: NextRequest) => proxyRequest(req, "POST", "/admin/shop/variant-attributes");
