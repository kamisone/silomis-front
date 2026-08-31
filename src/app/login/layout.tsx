import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

/**
 * The back-office sign-in page. The admin section itself is already noindex
 * via its own layout, but /login sits outside /admin and would otherwise be
 * the one indexable door into it.
 */
export const metadata: Metadata = {
  title: "Sign in",
  robots: NO_INDEX,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
