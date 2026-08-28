import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// Carrier credentials live server-side: the browser only ever reaches Mondial
// Relay through this proxy and the backend adapter behind it.
export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/public/shop/shipping/pickup-points", { auth: false });
