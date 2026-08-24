"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AddToCartButton from "@/components/shop/AddToCartButton";
import ProductVariantSelector, { type SelectableVariant } from "@/components/shop/ProductVariantSelector";
import WishlistButton from "@/components/shop/WishlistButton";
import ReplayRecorderMount from "@/components/shop/ReplayRecorderMount";
import ReviewsSection from "./ReviewsSection";
import { trackProductView } from "@/lib/shop/behaviorTracking";
import { pixelTrack, trackServerEvent } from "@/lib/metaPixel";
import { ttqTrack, trackTikTokServerEvent } from "@/lib/tiktokPixel";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./ProductDetail.module.css";

type T = ReturnType<typeof getTranslations>;

interface ResolvedMediaItem {
  key: string;
  type: "image" | "video";
  posterKey?: string | null;
  altText?: string | null;
  url: string;
  posterUrl: string | null;
}

interface InfoSection {
  id: string;
  key: string;
  label: string;
  value: string;
  sortOrder: number;
}

interface TrustBadge {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  link?: string;
  sortOrder: number;
}

interface Faq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

interface PackageContentItem {
  id: string;
  key: string;
  label?: string | null;
  url: string;
  sortOrder: number;
  isActive: boolean;
}

interface StoryItem {
  id: string;
  key: string;
  location: "side" | "narrative";
  altText?: string | null;
  title: string;
  description: string;
  url: string;
  sortOrder: number;
  isActive: boolean;
}

interface SocialVideo {
  id: string;
  key: string;
  title?: string | null;
  url: string;
  sortOrder: number;
  isActive: boolean;
}

interface CategoryRef {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  brand: string | null;
  basePriceCents: number | null;
  featuredImageUrl: string | null;
  galleryImageUrls: string[];
  media: ResolvedMediaItem[];
  specifications: Record<string, unknown> | null;
  infoSections: InfoSection[];
  trustBadges: TrustBadge[];
  faqs: Faq[];
  packageContents: PackageContentItem[];
  storyGallery: StoryItem[];
  socialVideos: SocialVideo[];
  socialVideosTitle?: string | null;
  freeShipping?: boolean;
  categories: CategoryRef[];
  primaryCategory: CategoryRef | null;
  variants: SelectableVariant[];
  isTestProduct?: boolean;
}

interface GalleryItem {
  type: "image" | "video";
  url: string;
  posterUrl: string | null;
  altText?: string | null;
}

function centsToAmount(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

function buildGallery(product: Product): GalleryItem[] {
  if (product.media?.length) {
    const seen = new Set<string>();
    const out: GalleryItem[] = [];
    for (const m of product.media) {
      if (!m.url || seen.has(m.url)) continue;
      seen.add(m.url);
      out.push({ type: m.type, url: m.url, posterUrl: m.posterUrl ?? null, altText: m.altText ?? null });
    }
    if (out.length) return out;
  }
  const urls: string[] = [];
  if (product.featuredImageUrl) urls.push(product.featuredImageUrl);
  for (const u of product.galleryImageUrls ?? []) if (!urls.includes(u)) urls.push(u);
  return urls.map((url) => ({ type: "image" as const, url, posterUrl: null }));
}

function ProductGallery({ items, title }: { items: GalleryItem[]; title: string }) {
  const [index, setIndex] = useState(0);
  const active = items[index] ?? null;

  if (!items.length) {
    return (
      <div className={styles.gallery}>
        <div className={styles.galleryMain}>
          <div className={styles.galleryPlaceholder} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.gallery}>
      <div className={styles.galleryMain}>
        {active?.type === "video" ? (
          <video src={active.url} poster={active.posterUrl ?? undefined} controls className={styles.galleryMedia} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active?.url} alt={active?.altText ?? title} className={styles.galleryMedia} />
        )}
      </div>
      {items.length > 1 && (
        <div className={styles.galleryThumbs}>
          {items.map((item, i) => (
            <button key={item.url} type="button" className={`${styles.galleryThumb} ${i === index ? styles.galleryThumbActive : ""}`} onClick={() => setIndex(i)} aria-label={`View media ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.type === "video" ? (item.posterUrl ?? item.url) : item.url} alt="" className={styles.galleryThumbImg} />
              {item.type === "video" && <span className={styles.galleryThumbPlay} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SpecificationsSection({ product, t }: { product: Product; t: T }) {
  if (product.infoSections?.length) {
    const sorted = [...product.infoSections].sort((a, b) => a.sortOrder - b.sortOrder);
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t.shop.specificationsTitle}</h2>
        <dl className={styles.specsTable}>
          {sorted.map((s) => (
            <div key={s.id} className={styles.specsRow}>
              <dt className={styles.specsLabel}>{s.label}</dt>
              <dd className={styles.specsValue}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }
  const specs = product.specifications;
  if (specs && typeof specs === "object" && Object.keys(specs).length > 0) {
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t.shop.specificationsTitle}</h2>
        <dl className={styles.specsTable}>
          {Object.entries(specs).map(([label, value]) => (
            <div key={label} className={styles.specsRow}>
              <dt className={styles.specsLabel}>{label}</dt>
              <dd className={styles.specsValue}>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }
  return null;
}

function PackageContentsSection({ items, t }: { items: PackageContentItem[]; t: T }) {
  const active = (items ?? []).filter((i) => i.isActive !== false && i.url);
  if (!active.length) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.shop.packageContentsTitle}</h2>
      <div className={styles.packageGrid}>
        {active.map((i) => (
          <div key={i.id} className={styles.packageItem}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.url} alt={i.label ?? ""} className={styles.packageImage} />
            {i.label && <span className={styles.packageLabel}>{i.label}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function StoryGallerySection({ items, t }: { items: StoryItem[]; t: T }) {
  const active = (items ?? []).filter((i) => i.isActive !== false && i.url);
  if (!active.length) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.shop.storyTitle}</h2>
      <div className={styles.storyGrid}>
        {active.map((i) => (
          <figure key={i.id} className={styles.storyItem}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.url} alt={i.altText ?? i.title ?? ""} className={styles.storyImage} />
            {(i.title || i.description) && (
              <figcaption className={styles.storyCaption}>
                {i.title && <strong>{i.title}</strong>}
                {i.description && <p>{i.description}</p>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

function SocialVideosSection({ videos, title, t }: { videos: SocialVideo[]; title?: string | null; t: T }) {
  const active = (videos ?? []).filter((v) => v.isActive !== false && v.url);
  if (!active.length) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title?.trim() || t.shop.videosTitle}</h2>
      <div className={styles.videoGrid}>
        {active.map((v) => (
          <div key={v.id} className={styles.videoItem}>
            <video src={v.url} controls className={styles.videoPlayer} />
            {v.title && <span className={styles.videoLabel}>{v.title}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function TrustBadgesRow({ badges }: { badges: TrustBadge[] }) {
  if (!badges?.length) return null;
  const sorted = [...badges].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className={styles.trustRow}>
      {sorted.map((b) => {
        const content = (
          <>
            <span className={styles.trustIcon} aria-hidden="true">
              ✓
            </span>
            <span className={styles.trustText}>
              {b.title}
              {b.subtitle && <span className={styles.trustSubtitle}>{b.subtitle}</span>}
            </span>
          </>
        );
        return b.link ? (
          <a key={b.id} href={b.link} className={`${styles.trustItem} ${styles.trustLink}`} target="_blank" rel="noopener noreferrer">
            {content}
          </a>
        ) : (
          <span key={b.id} className={styles.trustItem}>
            {content}
          </span>
        );
      })}
    </div>
  );
}

function FaqSection({ faqs, t }: { faqs: Faq[]; t: T }) {
  const active = (faqs ?? []).filter((f) => f.isActive !== false);
  if (!active.length) return null;
  const sorted = [...active].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.shop.faqTitle}</h2>
      <div className={styles.faqList}>
        {sorted.map((f) => (
          <details key={f.id} className={styles.faqItem}>
            <summary className={styles.faqToggle}>{f.question}</summary>
            <div className={styles.faqAnswer}>{f.answer}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Picks the initial variant using the same "default, else first in-stock,
 * else first" preference as ProductVariantSelector's own initial selection —
 * kept in sync so the price/stock shown before the selector's effect fires
 * matches what it resolves to. */
function pickInitialVariant(product: Product): SelectableVariant | null {
  const withOptions = product.variants.filter((v) => v.options.length > 0);
  if (withOptions.length > 0) {
    return withOptions.find((v) => v.isDefault) ?? withOptions.find((v) => (v.inventoryItem?.available ?? 0) > 0) ?? withOptions[0];
  }
  return product.variants.find((v) => v.isDefault) ?? product.variants[0] ?? null;
}

export default function ShopProductDetail({ product, locale }: { product: Product; locale: Locale }) {
  const t = getTranslations(locale);
  const gallery = useMemo(() => buildGallery(product), [product]);
  const hasVariants = useMemo(() => product.variants.some((v) => v.options.length > 0), [product]);
  const [selectedVariant, setSelectedVariant] = useState<SelectableVariant | null>(() => pickInitialVariant(product));

  const priceCents = selectedVariant?.priceCents ?? product.basePriceCents ?? 0;
  const compareAtCents = selectedVariant?.compareAtPriceCents ?? null;
  const isOnSale = !!(compareAtCents && compareAtCents > priceCents);
  const discount = isOnSale ? Math.round((1 - priceCents / compareAtCents!) * 100) : null;

  const noMatch = hasVariants && !selectedVariant;
  const available = selectedVariant?.inventoryItem?.available ?? 0;
  const outOfStock = !!selectedVariant && available <= 0;

  const selectedOptionValueIds = useMemo(() => (selectedVariant?.options ?? []).map((o) => o.optionValueId).filter((id): id is string => !!id), [selectedVariant]);

  const breadcrumbCategory = product.primaryCategory ?? product.categories?.[0] ?? null;

  useEffect(() => {
    trackProductView(product.id);
  }, [product.id]);

  // Meta Pixel / TikTok: value/currency/ids only — never add customer PII here.
  // Fires once per distinct product (App Router can reuse this component
  // across client-side navigations between products without a full remount).
  // Same eventId shared between the browser pixel and the server-side
  // Conversions/Events API call for dedup.
  const viewContentFiredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (viewContentFiredForRef.current === product.id) return;
    viewContentFiredForRef.current = product.id;

    const eventId = crypto.randomUUID();
    const customData = {
      content_type: "product",
      content_ids: [product.id],
      content_name: product.title,
      value: priceCents / 100,
      currency: "EUR",
    };
    pixelTrack("ViewContent", customData, eventId);
    trackServerEvent("ViewContent", eventId, customData);

    // TikTok: separate event ID — dedup is per-platform, no reason to share Meta's.
    const tiktokEventId = crypto.randomUUID();
    const tiktokProperties = {
      contents: [{ content_id: product.id, content_type: "product", content_name: product.title }],
      value: priceCents / 100,
      currency: "EUR",
    };
    ttqTrack("ViewContent", tiktokProperties, tiktokEventId);
    trackTikTokServerEvent("ViewContent", tiktokEventId, tiktokProperties);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  return (
    <div className={styles.page}>
      {product.isTestProduct && <ReplayRecorderMount productId={product.id} />}
      <div className={styles.container}>
        {breadcrumbCategory && (
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href={`/${locale}/shop`}>{t.shop.shopBreadcrumb}</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <Link href={`/${locale}/shop?categoryId=${breadcrumbCategory.id}`}>{breadcrumbCategory.name}</Link>
          </nav>
        )}

        <div className={styles.layout}>
          <div className={styles.galleryCol}>
            <ProductGallery items={gallery} title={product.title} />
          </div>

          <div className={styles.details}>
            {product.brand && <p className={styles.brand}>{product.brand}</p>}
            <h1 className={styles.title}>{product.title}</h1>

            <div className={styles.priceRow}>
              <span className={styles.price}>{centsToAmount(priceCents)}</span>
              {isOnSale && <span className={styles.comparePrice}>{centsToAmount(compareAtCents!)}</span>}
              {discount !== null && <span className={styles.discountBadge}>−{discount}%</span>}
            </div>

            {product.freeShipping && <div className={styles.freeShippingBanner}>{t.shop.freeShippingBanner}</div>}

            {product.shortDescription && <p className={styles.shortDesc}>{product.shortDescription}</p>}

            <ProductVariantSelector variants={product.variants} onVariantChange={setSelectedVariant} />

            {hasVariants && (
              <div className={`${styles.stockBadge} ${noMatch ? styles.stockUnavailable : outOfStock ? styles.stockOut : styles.stockIn}`}>
                {noMatch ? t.shop.selectOption : outOfStock ? t.shop.stockOutOfStock : t.shop.stockAvailable}
              </div>
            )}

            <div className={styles.addToCartRow ?? undefined} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <AddToCartButton
                variantId={selectedVariant?.id ?? "none"}
                className={styles.addToCartWrap}
                selectedOptionValueIds={selectedOptionValueIds.length ? selectedOptionValueIds : undefined}
                disabled={!selectedVariant || outOfStock}
                blockedLabel={noMatch ? t.shop.selectOption : outOfStock ? t.shop.stockOutOfStock : null}
              />
              <WishlistButton productId={product.id} variantId={selectedVariant?.id} />
            </div>

            <TrustBadgesRow badges={product.trustBadges} />

            {product.description && (
              <div className={styles.descSection}>
                <p className={styles.descBody}>{product.description}</p>
              </div>
            )}

            <SpecificationsSection product={product} t={t} />
          </div>
        </div>

        <PackageContentsSection items={product.packageContents} t={t} />
        <StoryGallerySection items={product.storyGallery} t={t} />
        <SocialVideosSection videos={product.socialVideos} title={product.socialVideosTitle} t={t} />
        <FaqSection faqs={product.faqs} t={t} />
        <ReviewsSection productId={product.id} locale={locale} />
      </div>
    </div>
  );
}
