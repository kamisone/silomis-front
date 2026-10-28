"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { chromeForPath, readNeutralSlug, setNeutralChrome } from "@/lib/shop/neutralChrome";
import { brandTabTitle, type StoreBrandChrome } from "@/lib/shop/storeBrand";
import { useStoreBrand } from "@/lib/shop/useStoreBrand";
import { SITE_NAME } from "@/lib/seo";

/**
 * In the storefront layout: keeps the neutral header on the pages of the flow
 * and drops it on the main shop's pages, on every client-side navigation.
 * Product pages are left to ProductChromeMark — only the product knows which
 * kind it is. Under a neutral brand, the tab title names the brand.
 */
export function NeutralChromeController() {
  const pathname = usePathname();
  useEffect(() => {
    const kind = chromeForPath(pathname);
    if (kind === "main") setNeutralChrome(null);
    else if (kind === "flow") setNeutralChrome(readNeutralSlug());
    // After the new page's own <title> is in.
    const t = setTimeout(() => brandTabTitle(SITE_NAME), 0);
    return () => clearTimeout(t);
  }, [pathname]);
  return null;
}

/**
 * On every product page. A neutral product turns the neutral header on (and
 * remembers it for the cart and checkout); a standard one turns it off. The
 * marker element lets CSS pick the right header from the server HTML on a
 * first visit, before any script has run — and, for a product sold under a
 * neutral brand, hide every Silomis mark until the brand's is drawn.
 */
export function ProductChromeMark({ neutral, slug, brand }: { neutral: boolean; slug: string; brand?: StoreBrandChrome | null }) {
  useEffect(() => {
    setNeutralChrome(neutral || brand ? slug : null, brand ?? null);
  }, [neutral, slug, brand]);
  return <BrandPageMark neutral={neutral || !!brand} brand={!!brand} />;
}

/** The markers globals.css reads; see ProductChromeMark. */
export function BrandPageMark({ neutral, brand }: { neutral: boolean; brand: boolean }) {
  return (
    <>
      <span data-chrome-mark={neutral ? "neutral" : "full"} hidden />
      {brand && <span data-brand-mark hidden />}
    </>
  );
}

/**
 * On the brand's own pages (About, FAQ, Contact, legal…): the brand is
 * stored as if the visitor came through its product, so the cart and
 * checkout that follow keep it.
 */
export function BrandChromeMark({ brand }: { brand: StoreBrandChrome }) {
  useEffect(() => {
    setNeutralChrome(readNeutralSlug() ?? brand.homeSlug ?? brand.slug, brand);
  }, [brand]);
  return <BrandPageMark neutral brand />;
}

/** The neutral logo: back to the product the visitor came for, not to the embroidery home page. */
export function NeutralHomeLink({ locale, className, ariaLabel, children }: { locale: string; className?: string; ariaLabel: string; children: React.ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  const pathname = usePathname();
  const brand = useStoreBrand();
  useEffect(() => {
    const t = setTimeout(() => setSlug(readNeutralSlug()), 0);
    return () => clearTimeout(t);
  }, [pathname]);
  // The stored slug can be the brand's own placeholder (a visitor who landed
  // on its About page) rather than a product.
  const product = slug && slug !== brand?.slug ? slug : (brand?.homeSlug ?? null);
  return (
    <Link href={product ? `/${locale}/shop/${encodeURIComponent(product)}` : `/${locale}/shop/cart`} className={className} aria-label={brand ? brand.name : ariaLabel}>
      {children}
    </Link>
  );
}

/**
 * The logo in the neutral header and footer: Silomis's (the children, hidden
 * by CSS on a brand's pages), or the brand's logo — its name when it has none.
 */
export function BrandLogo({
  className,
  nameClassName,
  byline,
  wordmarkClassName,
  bylineClassName,
  children,
}: {
  className?: string;
  nameClassName?: string;
  /** Signed under the name when there is no logo — "by Silomis". */
  byline?: string;
  wordmarkClassName?: string;
  bylineClassName?: string;
  children: React.ReactNode;
}) {
  const brand = useStoreBrand();
  return (
    <>
      <span className="silomis-mark">{children}</span>
      {brand &&
        (brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- any shape, any host the admin uploaded to
          <img src={brand.logoUrl} alt={brand.name} className={className} />
        ) : byline ? (
          <span className={wordmarkClassName}>
            <span className={nameClassName}>{brand.name}</span>
            <span className={bylineClassName}>{byline}</span>
          </span>
        ) : (
          <span className={nameClassName}>{brand.name}</span>
        ))}
    </>
  );
}

/** "Silomis" in running text — the brand's name on a brand's pages. */
export function BrandName() {
  const brand = useStoreBrand();
  return brand ? <>{brand.name}</> : <span className="silomis-mark">{SITE_NAME}</span>;
}
