import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://silomis.com";
const API = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

const PAGE_SIZE = 100;

interface PublicProduct {
  slug: string;
  updatedAt?: string;
}

interface PublicProductListResponse {
  items: PublicProduct[];
  total: number;
}

interface PublicCollection {
  slug: string;
}

async function fetchAllActiveProducts(): Promise<PublicProduct[]> {
  const products: PublicProduct[] = [];
  let offset = 0;

  // Safety cap in case `total` is ever wrong — never loop forever.
  for (let page = 0; page < 1000; page++) {
    try {
      const res = await fetch(`${API}/shop/products?limit=${PAGE_SIZE}&offset=${offset}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const data = (await res.json()) as PublicProductListResponse;
      const items = data.items ?? [];
      products.push(...items);
      offset += items.length;
      if (items.length < PAGE_SIZE || offset >= (data.total ?? 0)) break;
    } catch {
      break;
    }
  }

  return products;
}

/** Active collections only — the public endpoint already filters by isActive. */
async function fetchActiveCollections(): Promise<PublicCollection[]> {
  try {
    const res = await fetch(`${API}/shop/collections`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as PublicCollection[]) : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, collections] = await Promise.all([fetchAllActiveProducts(), fetchActiveCollections()]);
  const now = new Date();

  /**
   * One entry per URL, with every locale listed as an alternate.
   *
   * Paths must carry the locale segment: the middleware redirects a bare
   * `/shop/x` to `/{locale}/shop/x`, so the old locale-less entries pointed a
   * crawler at a redirect on every single line of the sitemap.
   */
  const entry = (path: string, opts: { lastModified?: Date; changeFrequency?: "daily" | "weekly" | "monthly"; priority?: number } = {}) => ({
    url: `${BASE_URL}/${DEFAULT_LOCALE}${path}`,
    lastModified: opts.lastModified ?? now,
    changeFrequency: opts.changeFrequency ?? "weekly",
    priority: opts.priority ?? 0.6,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${BASE_URL}/${l}${path}`])),
    },
  });

  // Deliberately absent: cart, checkout, wishlist, order tracking and search.
  // They are noindex and disallowed in robots.txt — listing them would ask a
  // crawler to fetch exactly what it has been told to skip.
  const staticPages: MetadataRoute.Sitemap = [
    entry("", { changeFrequency: "daily", priority: 1.0 }),
    entry("/shop", { changeFrequency: "daily", priority: 0.9 }),
    entry("/sale", { changeFrequency: "daily", priority: 0.8 }),
    entry("/new", { changeFrequency: "daily", priority: 0.8 }),
    entry("/collections", { priority: 0.7 }),
    // /blog is deliberately absent: articles are reached from the product they
    // are attached to, and nothing links to an index of all of them. Listing it
    // would ask a crawler to surface a page the storefront no longer navigates.

    entry("/about", { changeFrequency: "monthly", priority: 0.4 }),
    entry("/contact", { changeFrequency: "monthly", priority: 0.4 }),
    entry("/privacy-policy", { changeFrequency: "monthly", priority: 0.2 }),
    entry("/cookies", { changeFrequency: "monthly", priority: 0.2 }),
  ];

  const collectionPages: MetadataRoute.Sitemap = collections.map((collection) =>
    entry(`/collections/${collection.slug}`, { priority: 0.7 }),
  );

  const productPages: MetadataRoute.Sitemap = products.map((product) =>
    entry(`/shop/${product.slug}`, {
      // Real modification dates where the API gives them, so a crawler can
      // tell an edited product from an untouched one.
      lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
      priority: 0.8,
    }),
  );

  return [...staticPages, ...collectionPages, ...productPages];
}
