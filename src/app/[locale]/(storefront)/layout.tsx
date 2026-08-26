import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CartProvider } from "@/components/shop/CartContext";
import { WishlistProvider } from "@/components/shop/WishlistContext";
import CartDrawer from "@/components/shop/CartDrawer";
import CommerceHeader from "@/components/layout/CommerceHeader";
import CommerceFooter from "@/components/layout/CommerceFooter";
import CookieConsentProvider from "@/components/consent/CookieConsentProvider";
import SupportWidget from "@/components/support/SupportWidget";
import LastSeenProductCard from "@/components/shop/LastSeenProductCard";
import MetaPixelLoader from "@/components/tracking/MetaPixelLoader";
import TikTokPixelLoader from "@/components/tracking/TikTokPixelLoader";
import { getMetaPixelConfig, getTikTokPixelConfig } from "@/lib/platformSettings";
import { isValidLocale, DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
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
          <CommerceHeader locale={locale} />
          {children}
          <CommerceFooter locale={locale} />
          <CartDrawer locale={locale} />
          <SupportWidget locale={locale} />
          <LastSeenProductCard locale={locale} />
        </WishlistProvider>
      </CartProvider>
    </CookieConsentProvider>
  );
}
