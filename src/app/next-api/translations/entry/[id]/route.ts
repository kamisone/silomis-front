import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return proxyRequest(req, "DELETE", `/translations/entry/${id}`);
};
