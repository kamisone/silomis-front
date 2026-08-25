"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageX } from "lucide-react";
import AddToCartButton from "@/components/shop/AddToCartButton";
import ProductVariantSelector, { type SelectableVariant } from "@/components/shop/ProductVariantSelector";
import WishlistButton from "@/components/shop/WishlistButton";
import ReplayRecorderMount from "@/components/shop/ReplayRecorderMount";
import PromotionBadge, { type PromotionInfo } from "@/components/shop/PromotionBadge";
import BackToTopButton from "@/components/BackToTopButton";
import { useCart } from "@/components/shop/CartContext";
import ProductGallery, { type GalleryMediaItem } from "./ProductGallery";
import ReviewsSection, { type ReviewItem } from "./ReviewsSection";
import ZoomedImagesGallery, { type ZoomedImageItem } from "./ZoomedImagesGallery";
import ReturnsGuarantee from "./ReturnsGuarantee";
import DeliveryDetails from "./DeliveryDetails";
import PackageContents from "./PackageContents";
import StorySideGallery from "./StorySideGallery";
import StoryNarrativeGallery from "./StoryNarrativeGallery";
import SocialVideosCarousel from "./SocialVideosCarousel";
import storyStyles from "./StoryGallery.module.css";
import { trackProductView } from "@/lib/shop/behaviorTracking";
import { pixelTrack, trackServerEvent } from "@/lib/metaPixel";
import { ttqTrack, trackTikTokServerEvent } from "@/lib/tiktokPixel";
import { formatStockError, stockCheckMessage } from "@/lib/shop/stockError";
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
  hlsUrl: string | null;
  durationSeconds: number | null;
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
  /** Narrative items only — defaults to '1:1' when absent (side items, or items saved before this field existed). */
  aspectRatio?: "1:1" | "16:9" | "9:16";
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
  hlsUrl?: string | null;
  posterUrl?: string | null;
  durationSeconds?: number | null;
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
  storyNarrativeTitle?: string | null;
  freeShipping?: boolean;
  freeShippingDaysMin?: number | null;
  freeShippingDaysMax?: number | null;
  freeShippingUpgradeMethods?: Array<{
    id: string;
    name: string;
    carrier: string | null;
    priceCents: number;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
    isActive?: boolean;
  }>;
  categories: CategoryRef[];
  primaryCategory: CategoryRef | null;
  variants: SelectableVariant[];
  isTestProduct?: boolean;
  zoomedImages?: ZoomedImageItem[];
  documents?: Array<{ id: string; title: string; url: string; originalFilename: string; sizeBytes: number }>;
  upsellingEnabled?: boolean;
  upsellTiers?: Array<{ id: string; quantity: number; unitPriceCents: number }>;
}

/**
 * Presentational only — the authoritative price is always resolved
 * server-side (cart add/update, checkout re-verification). Mirrors that same
 * "flat price, highest qualifying quantity wins" rule purely so the price
 * shown before adding to cart matches what will actually be charged.
 */
function resolveDisplayUnitPriceCents(basePriceCents: number, quantity: number, product: Product): number {
  if (!product.upsellingEnabled || !product.upsellTiers?.length) return basePriceCents;
  const bestTier = product.upsellTiers.filter((t) => t.quantity <= quantity).sort((a, b) => b.quantity - a.quantity)[0];
  return bestTier ? bestTier.unitPriceCents : basePriceCents;
}

interface ReviewStats {
  average: number;
  count: number;
  distribution?: Record<string, number>;
}

interface ResolvedVariant {
  id: string;
  sku: string;
  title: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  available: number;
  optionValueIds: string[];
  featuredMediaUrl: string | null;
}

type ResolveStatus = "idle" | "loading" | "available" | "out_of_stock" | "unavailable";

function centsToAmount(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

function buildGallery(product: Product): GalleryMediaItem[] {
  if (product.media?.length) {
    const seen = new Set<string>();
    const out: GalleryMediaItem[] = [];
    for (const m of product.media) {
      if (!m.url || seen.has(m.url)) continue;
      seen.add(m.url);
      out.push({ type: m.type, url: m.url, hlsUrl: m.hlsUrl ?? null, posterUrl: m.posterUrl ?? null, alt: m.altText ?? undefined, durationSeconds: m.durationSeconds ?? null });
    }
    if (out.length) return out;
  }
  const urls: string[] = [];
  if (product.featuredImageUrl) urls.push(product.featuredImageUrl);
  for (const u of product.galleryImageUrls ?? []) if (!urls.includes(u)) urls.push(u);
  return urls.map((url) => ({ type: "image" as const, url, posterUrl: null }));
}

/** Bare content (no outer section/border) — the caller decides how to wrap it
 *  depending on context: standalone (own border-top divider) or grouped
 *  alongside Zoomed Images/FAQ next to the sticky Story Side Gallery (flex
 *  gap only, no divider — see the layout assembly further down). */
function SpecificationsSection({ product, t }: { product: Product; t: T }) {
  if (product.infoSections?.length) {
    const sorted = [...product.infoSections].sort((a, b) => a.sortOrder - b.sortOrder);
    return (
      <>
        <h2 className={styles.sectionTitle}>{t.shop.specificationsTitle}</h2>
        <dl className={styles.specsTable}>
          {sorted.map((s) => (
            <div key={s.id} className={styles.specsRow}>
              <dt className={styles.specsLabel}>{s.label}</dt>
              <dd className={styles.specsValue}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </>
    );
  }
  const specs = product.specifications;
  if (specs && typeof specs === "object" && Object.keys(specs).length > 0) {
    return (
      <>
        <h2 className={styles.sectionTitle}>{t.shop.specificationsTitle}</h2>
        <dl className={styles.specsTable}>
          {Object.entries(specs).map(([label, value]) => (
            <div key={label} className={styles.specsRow}>
              <dt className={styles.specsLabel}>{label}</dt>
              <dd className={styles.specsValue}>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </>
    );
  }
  return null;
}

function DocumentsSection({
  documents,
}: {
  documents?: Array<{ id: string; title: string; url: string; originalFilename: string; sizeBytes: number }>;
}) {
  const active = (documents ?? []).filter((d) => d.url);
  if (!active.length) return null;
  return (
    <section className={styles.section}>
      <div className={styles.documentsList}>
        {active.map((doc) => (
          <div key={doc.id} className={styles.documentCard}>
            <div className={styles.documentIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className={styles.documentInfo}>
              <span className={styles.documentTitle}>{doc.title}</span>
              <span className={styles.documentMeta}>PDF · {(doc.sizeBytes / 1024).toFixed(0)} KB</span>
            </div>
            <a href={doc.url} target="_blank" rel="noopener noreferrer" download className={styles.documentDownload} aria-label={doc.title}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
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
    <>
      <h2 className={styles.sectionTitle}>{t.shop.faqTitle}</h2>
      <div className={styles.faqList}>
        {sorted.map((f) => (
          <details key={f.id} className={styles.faqItem}>
            <summary className={styles.faqToggle}>
              <span className={styles.faqQuestion}>{f.question}</span>
              <span className={styles.faqChevron} aria-hidden="true" />
            </summary>
            <div className={styles.faqAnswer}>{f.answer}</div>
          </details>
        ))}
      </div>
    </>
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

export default function ShopProductDetail({
  product,
  locale,
  reviewStats,
  activePromotion,
  initialReviews,
}: {
  product: Product;
  locale: Locale;
  reviewStats?: ReviewStats;
  activePromotion?: PromotionInfo | null;
  initialReviews?: { items: ReviewItem[]; total: number };
}) {
  const t = getTranslations(locale);
  const router = useRouter();
  const { cart, addItem, mutating } = useCart();
  const gallery = useMemo(() => buildGallery(product), [product]);
  const hasVariants = useMemo(() => product.variants.some((v) => v.options.length > 0), [product]);
  const [selectedVariant, setSelectedVariant] = useState<SelectableVariant | null>(() => pickInitialVariant(product));

  const noMatch = hasVariants && !selectedVariant;
  const selectedOptionValueIds = useMemo(() => (selectedVariant?.options ?? []).map((o) => o.optionValueId).filter((id): id is string => !!id), [selectedVariant]);

  // Real-time SKU resolution: call the backend on every full combination
  // change, so price/stock reflect what's actually purchasable right now
  // (e.g. someone else just bought the last unit) instead of the snapshot
  // baked into the initial page load.
  const [resolveStatus, setResolveStatus] = useState<ResolveStatus>("idle");
  const [resolvedVariant, setResolvedVariant] = useState<ResolvedVariant | null>(null);
  const selKey = selectedOptionValueIds.join(",");
  useEffect(() => {
    if (!hasVariants || !selKey) {
      const t = setTimeout(() => {
        setResolveStatus("idle");
        setResolvedVariant(null);
      }, 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    const loadingTimer = setTimeout(() => setResolveStatus("loading"), 0);
    fetch(`/next-api/public/shop/products/${product.slug}/variants/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionValueIds: selKey.split(","), lang: locale !== "fr" ? locale : undefined }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { status: ResolveStatus; variant: ResolvedVariant | null }) => {
        if (!cancelled) {
          setResolveStatus(data.status ?? "unavailable");
          setResolvedVariant(data.variant ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setResolveStatus("idle");
      });
    return () => {
      cancelled = true;
      clearTimeout(loadingTimer);
    };
  }, [hasVariants, selKey, product.slug, locale]);

  // Prefer resolved (real-time) data; fall back to the selector's own pick, then the product default.
  const activeId = resolvedVariant?.id ?? selectedVariant?.id ?? null;
  const priceCents = resolvedVariant?.priceCents ?? selectedVariant?.priceCents ?? product.basePriceCents ?? 0;
  const compareAtCents = resolvedVariant?.compareAtPriceCents ?? selectedVariant?.compareAtPriceCents ?? null;
  const isOnSale = !!(compareAtCents && compareAtCents > priceCents);
  const discount = isOnSale ? Math.round((1 - priceCents / compareAtCents!) * 100) : null;

  const isOos = resolveStatus === "out_of_stock" || (!hasVariants && !!selectedVariant && (selectedVariant.inventoryItem?.available ?? 0) <= 0);
  const isUnavailable = resolveStatus === "unavailable";
  const isBlocked = isOos || isUnavailable;
  const verifying = resolveStatus === "loading";

  const inCart = cart?.items.some((item) => item.variantId === activeId) ?? false;

  const [qty, setQty] = useState(1);
  const [qtyError, setQtyError] = useState("");
  const [qtyMax, setQtyMax] = useState<number | null>(null);
  const [buyingNow, setBuyingNow] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [stockChecking, setStockChecking] = useState(false);
  const stockCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset qty and its cap whenever the active variant changes
  useEffect(() => {
    const t = setTimeout(() => {
      setQty(1);
      setQtyMax(null);
      setQtyError("");
    }, 0);
    return () => clearTimeout(t);
  }, [activeId]);

  // Structured-variant products already get authoritative stock from /resolve — sync qtyMax from that.
  useEffect(() => {
    if (!hasVariants || !resolvedVariant) return;
    const av = resolvedVariant.available;
    const t = setTimeout(() => {
      setQtyMax(av === -1 ? null : av);
      if (av !== -1 && av > 0) setQty((q) => (q > av ? av : q));
    }, 0);
    return () => clearTimeout(t);
  }, [resolvedVariant, hasVariants]);

  useEffect(() => {
    return () => {
      if (stockCheckTimer.current) clearTimeout(stockCheckTimer.current);
    };
  }, []);

  // Debounced backend stock check for simple (no-variant) products only —
  // structured-variant products are covered by the /resolve effect above.
  const scheduleStockCheck = useCallback(
    (newQty: number) => {
      if (!activeId || hasVariants) return;
      if (stockCheckTimer.current) clearTimeout(stockCheckTimer.current);
      setStockChecking(true);
      stockCheckTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/next-api/public/shop/variants/${activeId}/stock`);
          if (res.ok) {
            const { available } = (await res.json()) as { available: number };
            const msg = stockCheckMessage(available, newQty, t);
            setQtyError(msg || "");
            if (available !== -1) {
              setQtyMax(available);
              if (available > 0 && newQty > available) setQty(available);
            } else {
              setQtyMax(null);
            }
          }
        } catch {
          /* fail open — backend enforces at add-to-cart */
        }
        setStockChecking(false);
      }, 400);
    },
    [activeId, hasVariants, t],
  );

  const handleQtyIncrement = useCallback(() => {
    if (qtyMax !== null && qty >= qtyMax) return;
    setQtyError("");
    const next = qty + 1;
    setQty(next);
    scheduleStockCheck(next);
  }, [qty, qtyMax, scheduleStockCheck]);

  const handleQtyDecrement = useCallback(() => {
    setQtyError("");
    const next = Math.max(1, qty - 1);
    setQty(next);
    scheduleStockCheck(next);
  }, [qty, scheduleStockCheck]);

  async function handleBuyNow() {
    if (!activeId || isBlocked || verifying) return;
    setBuyError("");

    // Already in the cart: don't re-add (additive on the backend, may exceed
    // remaining stock) — just go straight to checkout.
    if (inCart) {
      router.push(`/${locale}/shop/checkout`);
      return;
    }

    setBuyingNow(true);
    const result = await addItem(activeId, qty, selectedOptionValueIds.length ? selectedOptionValueIds : undefined);
    if (result.ok) {
      router.push(`/${locale}/shop/checkout`);
    } else {
      setBuyError(formatStockError(result, t));
      setBuyingNow(false);
    }
  }

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

  // Whole product unavailable: every variant's inventory is at (or below)
  // zero — -1 means unlimited stock and never counts as out of stock.
  const allOutOfStock = useMemo(
    () =>
      product.variants.length > 0 &&
      product.variants.every((v) => {
        const av = v.inventoryItem?.available ?? 0;
        return av !== -1 && av <= 0;
      }),
    [product.variants],
  );

  // Presentational mirror of the backend's tier resolution — see
  // resolveDisplayUnitPriceCents's doc comment. Falls back to priceCents
  // unchanged for every product without upselling enabled.
  const displayUnitPriceCents = resolveDisplayUnitPriceCents(priceCents, qty, product);
  const totalPriceCents = displayUnitPriceCents * qty;

  // Sticky mobile buy bar: appears once the main CTA row scrolls above the viewport.
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  useEffect(() => {
    const HEADER = 84;
    const handle = () => {
      if (window.innerWidth > 900) {
        setShowStickyBar(false);
        return;
      }
      if (actionsRef.current) {
        setShowStickyBar(actionsRef.current.getBoundingClientRect().bottom < HEADER);
      }
    };
    handle();
    window.addEventListener("scroll", handle, { passive: true });
    window.addEventListener("resize", handle, { passive: true });
    return () => {
      window.removeEventListener("scroll", handle);
      window.removeEventListener("resize", handle);
    };
  }, []);

  return (
    <div className={styles.page}>
      {product.isTestProduct && <ReplayRecorderMount productId={product.id} />}

      {allOutOfStock && (
        <div className={styles.oosStickyNotice} role="status">
          <span className={styles.oosStickyIcon} aria-hidden="true">
            <PackageX size={18} strokeWidth={1.75} />
          </span>
          <span className={styles.oosStickyCopy}>
            <span className={styles.oosStickyTitle}>{t.shop.productOosTitle}</span>
            <span className={styles.oosStickyText}>{t.shop.productOosText}</span>
          </span>
        </div>
      )}

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
            <ProductGallery media={gallery} title={product.title} focusUrl={resolvedVariant?.featuredMediaUrl ?? null} />
          </div>

          <div className={styles.details}>
            {product.brand && <p className={styles.brand}>{product.brand}</p>}
            <h1 className={styles.title}>{product.title}</h1>

            {!!reviewStats && reviewStats.count > 0 && (
              <a href="#reviews" className={styles.rating}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} style={{ opacity: i < Math.round(reviewStats.average) ? 1 : 0.25 }}>
                    ★
                  </span>
                ))}
                <span className={styles.ratingCount}>({reviewStats.count})</span>
              </a>
            )}

            <div className={styles.priceRow}>
              <span className={styles.price}>
                {qty > 1 ? (
                  <>
                    {centsToAmount(totalPriceCents)}
                    <span className={styles.unitPrice}>
                      {centsToAmount(displayUnitPriceCents)} × {qty}
                    </span>
                  </>
                ) : (
                  centsToAmount(displayUnitPriceCents)
                )}
              </span>
              {isOnSale && <span className={styles.comparePrice}>{centsToAmount(compareAtCents!)}</span>}
              {activePromotion ? (
                <PromotionBadge promotion={activePromotion} size="md" freeShippingLabel={t.shop.freeShippingBadge} />
              ) : (
                discount !== null && <span className={styles.discountBadge}>−{discount}%</span>
              )}
            </div>

            {/* Quantity discounts — clicking a tier raises qty; the price shown
                everywhere above already reflects it via displayUnitPriceCents.
                The actual charge is independently resolved server-side on add. */}
            {product.upsellingEnabled && !!product.upsellTiers?.length && (
              <div className={styles.upsellTiers}>
                {product.upsellTiers.map((tier) => {
                  const savingsPct = priceCents > 0 && tier.unitPriceCents < priceCents ? Math.round((1 - tier.unitPriceCents / priceCents) * 100) : null;
                  const isSelected = qty >= tier.quantity && displayUnitPriceCents === tier.unitPriceCents;
                  const unreachable = qtyMax !== null && qtyMax < tier.quantity;
                  const buyLine = t.shop.upsellTierBuyLine.replace("{qty}", String(tier.quantity)).replace("{price}", centsToAmount(tier.unitPriceCents));
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      className={`${styles.upsellTier} ${isSelected ? styles.upsellTierActive : ""}`}
                      disabled={unreachable || inCart || isBlocked || verifying}
                      title={unreachable ? t.shop.stockOnlyN.replace("{n}", String(qtyMax)) : undefined}
                      onClick={() => setQty(tier.quantity)}
                    >
                      <span className={styles.upsellTierMain}>{buyLine}</span>
                      {savingsPct !== null && <span className={styles.upsellTierBadge}>{t.shop.upsellSaveBadge.replace("{pct}", String(savingsPct))}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {activePromotion && <p className={styles.promoAppliedNote}>{t.shop.promotionAutoApplied.replace("{name}", activePromotion.name)}</p>}

            {product.shortDescription && <p className={styles.shortDesc}>{product.shortDescription}</p>}

            <ProductVariantSelector variants={product.variants} onVariantChange={setSelectedVariant} />

            {noMatch ? (
              <div className={`${styles.stockBadge} ${styles.stockUnavailable}`}>{t.shop.selectOption}</div>
            ) : (
              resolveStatus !== "idle" && (
                <div
                  className={`${styles.stockBadge} ${
                    resolveStatus === "available" ? styles.stockIn : resolveStatus === "loading" ? styles.stockUnavailable : styles.stockOut
                  }`}
                >
                  {resolveStatus === "available" && t.shop.stockAvailable}
                  {resolveStatus === "out_of_stock" && t.shop.stockOutOfStock}
                  {resolveStatus === "unavailable" && t.shop.stockUnavailable}
                  {resolveStatus === "loading" && t.shop.stockChecking}
                </div>
              )
            )}

            <div className={styles.qtyRow}>
              <span className={styles.qtyLabel}>{t.shop.quantity}</span>
              <div className={`${styles.qtyControl} ${inCart || isBlocked || verifying ? styles.qtyDisabled : ""}`}>
                <button type="button" onClick={handleQtyDecrement} className={styles.qtyBtn} disabled={mutating || qty <= 1 || inCart || isBlocked || verifying}>
                  −
                </button>
                <span className={styles.qty}>{qty}</span>
                <button
                  type="button"
                  onClick={handleQtyIncrement}
                  className={styles.qtyBtn}
                  disabled={mutating || (qtyMax !== null && qty >= qtyMax) || inCart || isBlocked || verifying}
                >
                  +
                </button>
              </div>
              {qtyError && <p className={styles.qtyError}>{qtyError}</p>}
              {stockChecking && !qtyError && <p className={styles.qtyChecking}>{t.shop.stockChecking}</p>}
            </div>

            <div id="product-actions" ref={actionsRef} className={styles.addToCartRow} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <AddToCartButton
                variantId={activeId ?? "none"}
                initialQty={qty}
                className={styles.addToCartWrap}
                selectedOptionValueIds={selectedOptionValueIds.length ? selectedOptionValueIds : undefined}
                disabled={verifying || !activeId || noMatch}
                blockedLabel={noMatch ? t.shop.selectOption : isUnavailable ? t.shop.stockUnavailable : isOos ? t.shop.stockOutOfStock : !activeId ? t.shop.addToCart : null}
              />
              <WishlistButton productId={product.id} variantId={selectedVariant?.id} />
            </div>

            {!noMatch && !isBlocked && (
              <button type="button" onClick={handleBuyNow} disabled={mutating || buyingNow || !activeId || verifying} className={styles.buyNowBtn}>
                {buyingNow ? t.shop.redirecting : t.shop.buyNow}
              </button>
            )}

            {buyError && <p className={styles.addError}>{buyError}</p>}

            <DeliveryDetails
              locale={locale}
              freeShipping={product.freeShipping}
              freeShippingDaysMin={product.freeShippingDaysMin}
              freeShippingDaysMax={product.freeShippingDaysMax}
              freeShippingUpgradeMethods={product.freeShippingUpgradeMethods}
            />

            <PackageContents locale={locale} items={product.packageContents ?? []} />

            <TrustBadgesRow badges={product.trustBadges} />

            {product.description && (
              <div className={styles.descSection}>
                <div className={styles.descBody} dangerouslySetInnerHTML={{ __html: product.description }} />
              </div>
            )}
          </div>
        </div>

        {(() => {
          const activeSocialVideos = (product.socialVideos ?? []).filter((v) => v.isActive !== false && v.url);
          const activeStory = (product.storyGallery ?? []).filter((s) => s.isActive !== false && s.url);
          const sideStory = activeStory.filter((s) => s.location === "side");
          const narrativeStory = activeStory.filter((s) => s.location === "narrative");
          const activeZoomed = (product.zoomedImages ?? []).filter((z) => z.url);

          // Built once so their truthiness (null when there's nothing to show)
          // decides both whether a divider wraps them and whether the sticky
          // side-gallery row even needs a left column at all.
          const specsBlock = SpecificationsSection({ product, t });
          const zoomedImagesBlock = activeZoomed.length > 0 && (
            <ZoomedImagesGallery items={activeZoomed} ariaLabel={t.shop.zoomedImagesAria} fullBleed={sideStory.length === 0} />
          );
          const faqBlock = FaqSection({ faqs: product.faqs, t });
          const hasLeft = !!(specsBlock || zoomedImagesBlock || faqBlock);

          return (
            <>
              {activeSocialVideos.length > 0 && (
                <SocialVideosCarousel
                  videos={activeSocialVideos}
                  title={product.socialVideosTitle?.trim() || t.shop.videosTitle}
                  ariaLabel={t.shop.socialVideosAria}
                />
              )}

              {sideStory.length > 0 ? (
                <div className={storyStyles.faqStoryRow}>
                  {hasLeft && (
                    <div className={storyStyles.faqStoryCol}>
                      {specsBlock}
                      {zoomedImagesBlock}
                      {faqBlock}
                    </div>
                  )}
                  <div className={storyStyles.sideStickyCol}>
                    <StorySideGallery items={sideStory} ariaLabel={t.shop.storySideAria} />
                  </div>
                </div>
              ) : (
                <>
                  {specsBlock && <section className={styles.section}>{specsBlock}</section>}
                  {zoomedImagesBlock && <div className={styles.zoomedImagesSectionFull}>{zoomedImagesBlock}</div>}
                  {faqBlock && <section className={styles.section}>{faqBlock}</section>}
                </>
              )}

              {narrativeStory.length > 0 && (
                <StoryNarrativeGallery items={narrativeStory} ariaLabel={t.shop.storyNarrativeAria} overline={product.storyNarrativeTitle} />
              )}
            </>
          );
        })()}

        <DocumentsSection documents={product.documents} />

        <ReturnsGuarantee title={t.shop.returnsTitle} body={t.shop.returnsBody} buttonLabel={t.shop.returnsButton} ariaLabel={t.shop.returnsAria} />

        <ReviewsSection
          productId={product.id}
          locale={locale}
          stats={reviewStats ?? { average: 0, count: 0 }}
          initialReviews={initialReviews ?? { items: [], total: 0 }}
        />
      </div>

      {/* Sticky mobile buy bar — mobile/tablet only, hidden when the whole
          product is out of stock (the sticky notice above communicates that). */}
      <div className={`${styles.stickyBuyBar} ${showStickyBar && !allOutOfStock ? styles.stickyBuyBarVisible : ""}`} aria-hidden={!showStickyBar || allOutOfStock}>
        <div className={styles.stickyMeta}>
          <span className={styles.stickyPrice}>{qty > 1 ? centsToAmount(totalPriceCents) : centsToAmount(displayUnitPriceCents)}</span>
          {isOnSale && <span className={styles.stickyCompare}>{centsToAmount(compareAtCents!)}</span>}
          {selectedVariant?.title && <span className={styles.stickyVariant}>{selectedVariant.title}</span>}
          {resolveStatus === "available" && <span className={`${styles.stickyStock} ${styles.stickyStockAvail}`}>{t.shop.stockAvailable}</span>}
          {resolveStatus === "out_of_stock" && <span className={`${styles.stickyStock} ${styles.stickyStockOos}`}>{t.shop.stockOutOfStock}</span>}
        </div>
        <div className={styles.stickyActions}>
          <AddToCartButton
            variantId={activeId ?? "none"}
            initialQty={qty}
            className={styles.stickyCartWrap}
            selectedOptionValueIds={selectedOptionValueIds.length ? selectedOptionValueIds : undefined}
            disabled={verifying || !activeId || noMatch}
            blockedLabel={noMatch ? t.shop.selectOption : isUnavailable ? t.shop.stockUnavailable : isOos ? t.shop.stockOutOfStock : !activeId ? t.shop.addToCart : null}
          />
          {!noMatch && !isBlocked && (
            <button type="button" onClick={handleBuyNow} disabled={mutating || buyingNow || verifying} className={styles.stickyBuyBtn}>
              {buyingNow ? t.shop.redirecting : t.shop.buyNow}
            </button>
          )}
        </div>
      </div>

      <BackToTopButton ariaLabel={t.shop.backToTop} />
    </div>
  );
}
