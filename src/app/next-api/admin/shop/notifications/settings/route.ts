import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/admin/shop/notifications/settings");
export const PUT = (req: NextRequest) => proxyRequest(req, "PUT", "/admin/shop/notifications/settings");
