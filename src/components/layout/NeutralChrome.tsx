"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { chromeForPath, readNeutralSlug, setNeutralChrome } from "@/lib/shop/neutralChrome";

/**
 * In the storefront layout: keeps the neutral header on the pages of the flow
 * and drops it on the main shop's pages, on every client-side navigation.
 * Product pages are left to ProductChromeMark — only the product knows which
 * kind it is.
 */
export function NeutralChromeController() {
  const pathname = usePathname();
  useEffect(() => {
    const kind = chromeForPath(pathname);
    if (kind === "product") return;
    if (kind === "main") setNeutralChrome(null);
    else setNeutralChrome(readNeutralSlug());
  }, [pathname]);
  return null;
}

/**
 * On every product page. A neutral product turns the neutral header on (and
 * remembers it for the cart and checkout); a standard one turns it off. The
 * marker element lets CSS pick the right header from the server HTML on a
 * first visit, before any script has run.
 */
export function ProductChromeMark({ neutral, slug }: { neutral: boolean; slug: string }) {
  useEffect(() => {
    setNeutralChrome(neutral ? slug : null);
  }, [neutral, slug]);
  return <span data-chrome-mark={neutral ? "neutral" : "full"} hidden />;
}

/** The neutral logo: back to the product the visitor came for, not to the embroidery home page. */
export function NeutralHomeLink({ locale, className, ariaLabel, children }: { locale: string; className?: string; ariaLabel: string; children: React.ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    const t = setTimeout(() => setSlug(readNeutralSlug()), 0);
    return () => clearTimeout(t);
  }, [pathname]);
  return (
    <Link href={slug ? `/${locale}/shop/${encodeURIComponent(slug)}` : `/${locale}/shop/cart`} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
