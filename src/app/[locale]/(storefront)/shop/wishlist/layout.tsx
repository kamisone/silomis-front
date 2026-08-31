import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

/**
 * A layout purely to carry metadata: the pages under here are client
 * components and cannot export it themselves.
 *
 * Session-bound and personal — nothing a search result should ever land on.
 * robots.txt already blocks the crawl; this covers the case it cannot, where a
 * URL is linked from elsewhere and indexed without being fetched.
 */
export const metadata: Metadata = { robots: NO_INDEX };

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
  return children;
}
