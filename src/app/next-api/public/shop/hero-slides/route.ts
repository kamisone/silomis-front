import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/shop/hero-slides", { auth: false });
