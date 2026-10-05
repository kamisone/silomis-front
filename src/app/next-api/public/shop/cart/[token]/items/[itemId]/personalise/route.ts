import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/** Embroider one unit of a plain line already in the basket. */
export const POST = async (req: NextRequest, { params }: { params: Promise<{ token: string; itemId: string }> }) => {
  const { token, itemId } = await params;
  return proxyRequest(req, "POST", `/shop/cart/${token}/items/${itemId}/personalise`, { auth: false });
};

/** The stored designs on a personalised line, for the editor to reopen. */
export const GET = async (req: NextRequest, { params }: { params: Promise<{ token: string; itemId: string }> }) => {
  const { token, itemId } = await params;
  return proxyRequest(req, "GET", `/shop/cart/${token}/items/${itemId}/personalise`, { auth: false });
};

/** Change the embroidery on a personalised line. */
export const PUT = async (req: NextRequest, { params }: { params: Promise<{ token: string; itemId: string }> }) => {
  const { token, itemId } = await params;
  return proxyRequest(req, "PUT", `/shop/cart/${token}/items/${itemId}/personalise`, { auth: false });
};

/** Take the embroidery off a line. */
export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ token: string; itemId: string }> }) => {
  const { token, itemId } = await params;
  return proxyRequest(req, "DELETE", `/shop/cart/${token}/items/${itemId}/personalise`, { auth: false });
};
