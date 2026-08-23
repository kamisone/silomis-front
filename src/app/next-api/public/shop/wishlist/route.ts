import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/public/shop/wishlist", { auth: false });
export const POST = (req: NextRequest) => proxyRequest(req, "POST", "/public/shop/wishlist", { auth: false });
