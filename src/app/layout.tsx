import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import NextTopLoader from "nextjs-toploader";
import { ToastProvider } from "@/components/toast/ToastContext";
import Toaster from "@/components/toast/Toaster";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  /**
   * Without this every canonical, hreflang and og:image stays relative, which
   * is invalid in the markup crawlers read — Next resolves them against it.
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — slippers, sandals and flip-flops`,
    /** Pages set only their own subject; the brand is appended once, here. */
    template: `%s | ${SITE_NAME}`,
  },
  description: "Comfortable slippers, sandals and flip-flops for indoors, the beach and everywhere in between. Fast delivery and easy returns.",
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Set by middleware for locale-prefixed storefront routes; admin/login stay "en".
  const locale = (await headers()).get("x-locale") ?? "en";

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {/* Global nav-in-progress feedback — mounted once here so it covers
            every route (storefront + admin) instead of each section rolling
            its own. Brand accent color; no spinner, just the top bar. */}
        <NextTopLoader color="#d9548c" height={3} showSpinner={false} shadow="0 0 10px #d9548c,0 0 5px #d9548c" />
        <ToastProvider>
          {children}
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}
