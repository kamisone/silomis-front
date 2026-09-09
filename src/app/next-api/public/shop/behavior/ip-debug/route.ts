import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/**
 * Same diagnostic as the backend route, reached through this proxy — comparing
 * the two answers is what identifies the hop that loses the visitor's address.
 * No auth: it echoes only the caller's own request metadata.
 */
export const GET = (req: NextRequest) => proxyRequest(req, "GET", "/public/shop/behavior/ip-debug", { auth: false });
