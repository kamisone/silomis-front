import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// Per visitor: the backend reads the forwarded client IP. Never cached here.
export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/public/shop/shipping/destination", { auth: false });
