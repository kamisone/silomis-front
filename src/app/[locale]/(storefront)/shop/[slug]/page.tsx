import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Script from "next/script";
import ShopProductDetail, { type Product } from "./ShopProductDetail";
import RelatedSection from "@/components/shop/RelatedSection";
import { isValidLocale, DEFAULT_LOCALE } from "@/lib/i18n";

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://silomis.com";

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
}

async function fetchProduct(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/products/${slug}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Product;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProduct(slug);
  if (!product) return { title: "Product not found — Silomis" };
  return {
    title: product.seoTitle?.trim() || `${product.title} — Silomis`,
    description: product.seoDescription?.trim() || product.shortDescription || undefined,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug, locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const product = await fetchProduct(slug);
  if (!product) notFound();

  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0] ?? null;
  const images = [product.featuredImageUrl, ...(product.galleryImageUrls ?? [])].filter(
    (url): url is string => !!url,
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription ?? product.description ?? undefined,
    image: images.length > 0 ? images : undefined,
    sku: defaultVariant?.sku ?? undefined,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      price: (v.priceCents / 100).toFixed(2),
      priceCurrency: "EUR",
      availability:
        (v.inventoryItem?.available ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${APP_URL}/shop/${product.slug}`,
    })),
  };

  return (
    <>
      <Script id="product-jsonld" type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>
      <ShopProductDetail key={product.id} product={product} locale={locale} />
      <RelatedSection slug={product.slug} locale={locale} />
    </>
  );
}
