import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Pacifico } from "next/font/google";
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

/**
 * The wordmark only — the "ilomis" that follows the mark in the header, the
 * footer and the login panel. Nothing else on the site uses it.
 *
 * A script, because the mark is one continuous teal stroke and a straight sans
 * beside it read as two unrelated objects; Pacifico's own wave carries on out
 * of the swoosh, so the S and the letters after it look drawn in one go. It
 * ships in a single weight, which is why every lockup below sets 400.
 */
const brandFont = Pacifico({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
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

/**
 * White to match the fixed header, so the browser chrome and the top of the
 * page meet without a colour seam.
 */
export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Set by middleware for locale-prefixed storefront routes; admin/login stay "en".
  const locale = (await headers()).get("x-locale") ?? "en";

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} ${brandFont.variable}`}>
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
