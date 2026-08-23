import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PUT = async (req: NextRequest) => proxyRequest(req, "PUT", "/translations/bulk");
