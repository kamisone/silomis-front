import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ShopProductDetail, { type Product } from "./ShopProductDetail";
import JsonLd from "@/components/seo/JsonLd";
import RelatedSection from "@/components/shop/RelatedSection";
import RecordProductView from "@/components/shop/RecordProductView";
import RelatedProductsSkeleton from "@/components/shop/RelatedProductsSkeleton";
import type { PromotionInfo } from "@/components/shop/PromotionBadge";
import { isValidLocale, DEFAULT_LOCALE, getTranslations } from "@/lib/i18n";
import { localeAlternates } from "@/lib/seo";

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://silomis.com";

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<{ v?: string }>;
}

function langParam(locale: string): string {
  return locale !== DEFAULT_LOCALE ? `?lang=${locale}` : "";
}

async function fetchProduct(slug: string, locale: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/products/${slug}${langParam(locale)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Product;
  } catch {
    return null;
  }
}

interface AvailabilityVariant {
  variantSlug: string | null;
  title: string;
  featuredMediaUrl: string | null;
}

async function fetchAvailabilityMatrix(slug: string, locale: string): Promise<{ variants: AvailabilityVariant[] } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/products/${slug}/variants/availability${langParam(locale)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { variants: AvailabilityVariant[] };
  } catch {
    return null;
  }
}

interface ReviewStats {
  average: number;
  count: number;
  distribution?: Record<string, number>;
}

async function fetchReviewStats(slug: string): Promise<ReviewStats> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/products/${slug}/review-stats`, { cache: "no-store" });
    if (!res.ok) return { average: 0, count: 0 };
    return (await res.json()) as ReviewStats;
  } catch {
    return { average: 0, count: 0 };
  }
}

interface InitialReviews {
  items: Array<{
    id: string;
    authorName: string;
    rating: number;
    title: string | null;
    body: string | null;
    media: Array<{ key: string; type: "image" | "video"; url: string; altText?: string | null }>;
    isVerifiedPurchase: boolean;
    createdAt: string;
  }>;
  total: number;
}

async function fetchInitialReviews(productId: string): Promise<InitialReviews> {
  try {
    const res = await fetch(`${API_BASE_URL}/public/shop/reviews/product/${productId}?limit=10`, { cache: "no-store" });
    if (!res.ok) return { items: [], total: 0 };
    return (await res.json()) as InitialReviews;
  } catch {
    return { items: [], total: 0 };
  }
}

async function fetchActivePromotion(productId: string): Promise<PromotionInfo | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/promotions/for-product?productId=${productId}`, { cache: "no-store" });
    if (!res.ok || res.status === 204) return null;
    return (await res.json()) as PromotionInfo;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug, locale: rawLocale } = await params;
  const { v } = await searchParams;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const product = await fetchProduct(slug, locale);
  if (!product) return { title: "Product not found", robots: { index: false, follow: true } };

  let variantTitle = product.title;
  let variantImage = product.featuredImageUrl ?? undefined;
  if (v) {
    const matrix = await fetchAvailabilityMatrix(slug, locale);
    const variant = matrix?.variants.find((mv) => mv.variantSlug === v);
    if (variant) {
      variantTitle = `${product.title} — ${variant.title ?? v}`;
      if (variant.featuredMediaUrl) variantImage = variant.featuredMediaUrl;
    }
  }

  const description = product.shortDescription || undefined;
  const alternates = localeAlternates(locale, `/shop/${slug}`);

  return {
    title: variantTitle,
    description,
    openGraph: {
      title: variantTitle,
      description,
      type: "website",
      images: variantImage ? [{ url: variantImage }] : undefined,
    },
    twitter: {
      title: variantTitle,
      description,
      images: variantImage ? [variantImage] : undefined,
    },
    alternates: {
      ...alternates,
      // A selected variant is still this product's page, so the canonical
      // keeps the ?v= that identifies which one is on screen; the hreflang
      // set stays on the clean path shared by every locale.
      canonical: `${alternates.canonical}${v ? `?v=${v}` : ""}`,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug, locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const product = await fetchProduct(slug, locale);
  if (!product) notFound();

  const [reviewStats, activePromotion, initialReviews] = await Promise.all([
    fetchReviewStats(slug),
    fetchActivePromotion(product.id),
    fetchInitialReviews(product.id),
  ]);

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
      // Locale-prefixed: the bare /shop/... path only ever redirects, and an
      // offer URL that redirects is a wasted signal.
      url: `${APP_URL}/${locale}/shop/${product.slug}`,
    })),
    ...(reviewStats.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviewStats.average, reviewCount: reviewStats.count } }
      : {}),
  };

  const primaryCategory = product.primaryCategory ?? product.categories?.[0] ?? null;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: getTranslations(locale).shop.homeBreadcrumb, item: `${APP_URL}/${locale}` },
      ...(primaryCategory
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: primaryCategory.name,
              item: `${APP_URL}/${locale}/shop?categoryId=${primaryCategory.id}`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: primaryCategory ? 3 : 2,
        name: product.title,
        item: `${APP_URL}/${locale}/shop/${product.slug}`,
      },
    ],
  };

  const activeFaqs = (product.faqs ?? []).filter((f) => f.isActive);
  const faqJsonLd =
    activeFaqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: activeFaqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  return (
    <>
      <JsonLd id="product-jsonld" data={jsonLd} />
      <JsonLd id="product-breadcrumb-jsonld" data={breadcrumbJsonLd} />
      {faqJsonLd && <JsonLd id="product-faq-jsonld" data={faqJsonLd} />}
      {/* Remembers this product for the floating "recently viewed" card. The
          price mirrors what the listing card prints — the default variant's,
          falling back to the base price — so the two never disagree. */}
      <RecordProductView
        id={product.id}
        slug={product.slug}
        title={product.title}
        imageUrl={product.featuredImageUrl}
        priceCents={
          product.variants?.find((v) => v.isDefault)?.priceCents ?? product.variants?.[0]?.priceCents ?? product.basePriceCents
        }
      />
      <ShopProductDetail key={product.id} product={product} locale={locale} reviewStats={reviewStats} activePromotion={activePromotion} initialReviews={initialReviews} />
      <Suspense fallback={<RelatedProductsSkeleton />}>
        <RelatedSection slug={product.slug} locale={locale} />
      </Suspense>
    </>
  );
}
