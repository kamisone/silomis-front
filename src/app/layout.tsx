import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import NextTopLoader from "nextjs-toploader";
import { ToastProvider } from "@/components/toast/ToastContext";
import Toaster from "@/components/toast/Toaster";
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
  title: "Silomis",
  description: "Silomis — online shop",
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
