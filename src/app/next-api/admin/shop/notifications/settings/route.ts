import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/admin/shop/notifications/settings");
export const PATCH = (req: NextRequest) => proxyRequest(req, "PATCH", "/admin/shop/notifications/settings");
