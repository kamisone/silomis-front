import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// Served from a cached index, so this is safe to call on every keystroke.
export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/public/shop/shipping/pickup-points/localities", { auth: false });
