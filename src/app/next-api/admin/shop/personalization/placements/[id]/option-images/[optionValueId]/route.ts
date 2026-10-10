import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

type Params = { params: Promise<{ id: string; optionValueId: string }> };

/** A position's photo for one variation option. */
export const PUT = async (req: NextRequest, { params }: Params) => {
  const { id, optionValueId } = await params;
  return proxyRequest(req, "PUT", `/admin/shop/personalization/placements/${id}/option-images/${optionValueId}`);
};

export const DELETE = async (req: NextRequest, { params }: Params) => {
  const { id, optionValueId } = await params;
  return proxyRequest(req, "DELETE", `/admin/shop/personalization/placements/${id}/option-images/${optionValueId}`);
};
