import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/** Who is logged in. The admins screen uses it to stop you deleting yourself. */
export const GET = async (req: NextRequest) => proxyRequest(req, "GET", "/auth/me");
