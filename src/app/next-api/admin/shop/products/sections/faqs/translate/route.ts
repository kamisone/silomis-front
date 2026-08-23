import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const POST = async (req: NextRequest) => proxyRequest(req, "POST", "/admin/shop/products/sections/faqs/translate");
