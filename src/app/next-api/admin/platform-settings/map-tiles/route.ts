import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PUT = (req: NextRequest) => proxyRequest(req, "PUT", "/admin/platform-settings/map-tiles");
