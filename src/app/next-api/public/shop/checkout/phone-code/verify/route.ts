import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/** Checks the code the customer typed back. */
export const POST = (req: NextRequest) => proxyRequest(req, "POST", "/shop/checkout/phone-code/verify", { auth: false });
