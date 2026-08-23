import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ entityType: string; entityId: string }> }) => {
  const { entityType, entityId } = await params;
  return proxyRequest(req, "GET", `/translations/${entityType}/${entityId}`);
};
