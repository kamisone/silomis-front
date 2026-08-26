import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const POST = (req: NextRequest) => proxyRequest(req, "POST", "/admin/shop/hero-slides/sections/text/translate");
