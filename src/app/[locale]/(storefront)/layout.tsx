import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CartProvider } from "@/components/shop/CartContext";
import { WishlistProvider } from "@/components/shop/WishlistContext";
import CartDrawer from "@/components/shop/CartDrawer";
import CommerceHeader from "@/components/layout/CommerceHeader";
import CommerceFooter from "@/components/layout/CommerceFooter";
import NeutralHeader from "@/components/layout/NeutralHeader";
import NeutralFooter from "@/components/layout/NeutralFooter";
import { NeutralChromeController } from "@/components/layout/NeutralChrome";
import { NEUTRAL_CHROME_SCRIPT } from "@/lib/shop/neutralChrome";
import CookieConsentProvider from "@/components/consent/CookieConsentProvider";
import SupportWidget from "@/components/support/SupportWidget";
import LastSeenProductCard from "@/components/shop/LastSeenProductCard";
import MetaPixelLoader from "@/components/tracking/MetaPixelLoader";
import TikTokPixelLoader from "@/components/tracking/TikTokPixelLoader";
import { getMetaPixelConfig, getTikTokPixelConfig } from "@/lib/platformSettings";
import { isValidLocale, getTranslations, DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";
import { SITE_NAME } from "@/lib/seo";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * The storefront's defaults, in the page's own language. Without this every
 * page that sets no description of its own (sale, new arrivals, contact…)
 * inherited the root layout's English one in all eight languages.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const t = getTranslations(isValidLocale(raw) ? raw : DEFAULT_LOCALE).shop;
  return {
    // The subject only: the root layout's template appends "| Silomis" to a
    // segment default too, so naming the brand here would print it twice.
    title: { default: t.seoShopTitle, template: `%s | ${SITE_NAME}` },
    description: t.seoSiteDescription,
    openGraph: { siteName: SITE_NAME, type: "website", description: t.seoSiteDescription },
  };
}

// Plain-props fallback (matches src/app/admin/layout.tsx): Next.js 16's typed
// `LayoutProps<"/">` route helper is generated per top-level app route and
// doesn't have a clean equivalent for a route group's own segment, so this
// mirrors the existing convention elsewhere in the app instead.
export default async function StorefrontLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) redirect(`/${DEFAULT_LOCALE}`);

  const [metaPixel, tiktokPixel] = await Promise.all([getMetaPixelConfig(), getTikTokPixelConfig()]);

  return (
    <CookieConsentProvider locale={locale}>
      <Suspense fallback={null}>
        <MetaPixelLoader pixelId={metaPixel.pixelId} enabled={metaPixel.enabled} />
        <TikTokPixelLoader pixelId={tiktokPixel.pixelId} enabled={tiktokPixel.enabled} />
      </Suspense>
      <CartProvider>
        <WishlistProvider>
          {/* Full or neutral header/footer — both rendered, CSS shows one; see
              lib/shop/neutralChrome.ts. The script picks before first paint. */}
          <script dangerouslySetInnerHTML={{ __html: NEUTRAL_CHROME_SCRIPT }} />
          <NeutralChromeController />
          <div className="chrome-full">
            <CommerceHeader locale={locale} />
          </div>
          <div className="chrome-neutral">
            <NeutralHeader locale={locale} />
          </div>
          {children}
          <div className="chrome-full">
            <CommerceFooter locale={locale} />
          </div>
          <div className="chrome-neutral">
            <NeutralFooter locale={locale} />
          </div>
          <CartDrawer locale={locale} />
          <SupportWidget locale={locale} />
          <LastSeenProductCard locale={locale} />
        </WishlistProvider>
      </CartProvider>
    </CookieConsentProvider>
  );
}
