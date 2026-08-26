"use client";

import { useEffect } from "react";
import { rememberLastSeen } from "@/lib/lastSeenProduct";

/**
 * Records that this product was viewed, and renders nothing.
 *
 * A component rather than a call inside ShopProductDetail so the product page
 * stays a server component down to the parts that need to be interactive, and
 * so the recording is visible in the page's own JSX rather than buried in a
 * 900-line detail view.
 */
export default function RecordProductView({
  id,
  slug,
  title,
  imageUrl,
  priceCents,
}: {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  priceCents: number | null;
}) {
  useEffect(() => {
    rememberLastSeen({ id, slug, title, imageUrl, priceCents });
  }, [id, slug, title, imageUrl, priceCents]);

  return null;
}
