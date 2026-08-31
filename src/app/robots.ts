import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Crawl rules.
 *
 * Two separate jobs, and robots.txt only does the first: it stops crawlers
 * *fetching* these paths, but a URL linked from elsewhere can still be indexed
 * without ever being fetched. The pages themselves therefore also carry
 * `robots: noindex` metadata — see NO_INDEX in lib/seo.ts and the admin layout.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Back office and its sign-in page.
          "/admin",
          "/login",
          // The BFF proxy layer — JSON, never a landing page.
          "/next-api/",
          // Transactional pages: personal, session-bound, and worthless in an
          // index. Locale-prefixed, so wildcard the locale segment.
          "/*/shop/cart",
          "/*/shop/checkout",
          "/*/shop/wishlist",
          "/*/shop/orders",
          // Search result pages: infinite, thin, and duplicative of the
          // category listings that should rank instead.
          "/*/shop/search",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
