import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const POST = (req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) =>
  ctx.params.then(({ orderId }) => proxyRequest(req, "POST", `/shop/payment/${orderId}/reconcile`, { auth: false }));
