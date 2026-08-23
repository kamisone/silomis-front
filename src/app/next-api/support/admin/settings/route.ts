import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/support/admin/settings");
export const PATCH = (req: NextRequest) => proxyRequest(req, "PATCH", "/support/admin/settings");
