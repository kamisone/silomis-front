import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/** Texts a confirmation code to the phone on the checkout form (PhoneVerificationService). */
export const POST = (req: NextRequest) => proxyRequest(req, "POST", "/shop/checkout/phone-code", { auth: false });
