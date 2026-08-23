import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://silomis.com";
const API = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

const PAGE_SIZE = 100;

interface PublicProduct {
  slug: string;
}

interface PublicProductListResponse {
  items: PublicProduct[];
  total: number;
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await fetchAllActiveProducts();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/shop`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/shop/cart`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${BASE_URL}/shop/${product.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...productPages];
}
