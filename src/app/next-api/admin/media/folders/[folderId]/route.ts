import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ folderId: string }> }) => {
  const { folderId } = await params;
  return proxyRequest(req, "PATCH", `/admin/media/folders/${folderId}`);
};

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ folderId: string }> }) => {
  const { folderId } = await params;
  return proxyRequest(req, "DELETE", `/admin/media/folders/${folderId}`);
};
