import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/admin/platform-settings/currency");
export const PUT = (req: NextRequest) => proxyRequest(req, "PUT", "/admin/platform-settings/currency");
