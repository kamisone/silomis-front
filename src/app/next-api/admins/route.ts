import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest) => proxyRequest(req, "GET", "/admins");
export const POST = async (req: NextRequest) => proxyRequest(req, "POST", "/admins");
