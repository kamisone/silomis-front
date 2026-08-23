import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/shop/checkout/session", { auth: false });
export const PUT = (req: NextRequest) => proxyRequest(req, "PUT", "/shop/checkout/session", { auth: false });
