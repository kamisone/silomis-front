import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PATCH = (req: NextRequest) => proxyRequest(req, "PATCH", "/admin/shop/home-sections/reorder");
