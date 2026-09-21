import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/** Orders with unread customer messages — the Orders badge and list markers. */
export const GET = async (req: NextRequest) => proxyRequest(req, "GET", "/support/admin/orders/unread");
