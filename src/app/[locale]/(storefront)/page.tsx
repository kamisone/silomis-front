import type { Metadata } from "next";
import type { ProductListItem } from "@/components/shop/ProductCard";
import type { PromotionInfo } from "@/components/shop/PromotionBadge";
import HomeHero, { type HeroSlide } from "@/components/home/HomeHero";
import TrustBar from "@/components/home/TrustBar";
import CategoryTiles, { type HomeCategory } from "@/components/home/CategoryTiles";
import FeaturedCollections, { type HomeCollection } from "@/components/home/FeaturedCollections";
import OfferBanners from "@/components/home/OfferBanners";
import ProductRail from "@/components/home/ProductRail";
import PromoProductsCarousel from "@/components/home/PromoProductsCarousel";
import BlogTeasers, { type HomePost } from "@/components/home/BlogTeasers";
import SectionHeading from "@/components/home/SectionHeading";
import SectionSeparator from "@/components/home/SectionSeparator";
import SeoText from "@/components/home/SeoText";
import Faqs from "@/components/home/Faqs";
import {
  DEFAULT_HOME_SECTIONS,
  localized,
  sectionLimit,
  type HomeSectionSpec,
  type HomeSectionType,
  type ProductRailSource,
} from "@/components/home/sectionTypes";
import { getTranslations, isValidLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import styles from "./page.module.css";
import JsonLd from "@/components/seo/JsonLd";
import { localeAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 120;

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = getTranslations(locale).shop;
  return {
    // `absolute` so the home page is "Slippers, sandals and flip-flops |
    // Silomis" rather than repeating the brand through the template.
    title: { absolute: `${t.homeTitle} | ${SITE_NAME}` },
    description: t.homeSubtitle,
    alternates: localeAlternates(locale),
    openGraph: { title: t.homeTitle, description: t.homeSubtitle, type: "website" },
  };
}

interface ActivePromotion {
  id: string;
  name: string;
  description: string | null;
  discountType: "percentage" | "fixed_amount" | "free_shipping";
  discountValue: number;
  scope: "site_wide" | "category" | "product";
  linkedCategoryIds: string[];
  linkedProductIds: string[];
}

/** Every fetch is optional: a failure or an empty result hides that section
 *  rather than breaking the page. A brand-new install with an empty catalogue
 *  still renders a coherent hero + trust bar. */
async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { next: { revalidate } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/**
 * The reduced products an admin pinned to a promotion band.
 *
 * `onSale=true` travels with the ids so the API, not this page, decides what
 * still counts as reduced — a product whose promotion expired, or whose
 * compare-at price was removed, drops out of the band on its own rather than
 * sitting there with no badge. The admin's order is re-applied afterwards,
 * because the API answers in its own.
 */
async function fetchPromoProducts(section: HomeSectionSpec, locale: string): Promise<ProductListItem[]> {
  const ids = section.config.productIds ?? [];
  if (ids.length === 0) return [];
  const qs = new URLSearchParams({ ids: ids.join(","), onSale: "true", limit: String(ids.length), lang: locale });
  const data = await fetchJson<{ items?: ProductListItem[] }>(`/shop/products?${qs}`, {});
  const items = Array.isArray(data.items) ? data.items : [];
  const rank = new Map(ids.map((id, i) => [id, i]));
  return items.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

async function fetchProducts(section: HomeSectionSpec, locale: string): Promise<ProductListItem[]> {
  const source: ProductRailSource = section.config.source ?? "newest";
  const ids = section.config.productIds ?? [];

  // Hand-picked means exactly these, in exactly this order — so the limit is
  // ignored and the API's own ordering is re-applied here.
  if (source === "manual") {
    if (ids.length === 0) return [];
    const qs = new URLSearchParams({ ids: ids.join(","), limit: String(ids.length), lang: locale });
    const data = await fetchJson<{ items?: ProductListItem[] }>(`/shop/products?${qs}`, {});
    const items = Array.isArray(data.items) ? data.items : [];
    const rank = new Map(ids.map((id, i) => [id, i]));
    return items.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }

  const qs = new URLSearchParams({ limit: String(sectionLimit(section)), lang: locale });
  if (source === "featured") qs.set("featured", "true");
  else if (source === "on_sale") qs.set("onSale", "true");
  else qs.set("sort", "newest");
  const data = await fetchJson<{ items?: ProductListItem[] }>(`/shop/products?${qs}`, {});
  return Array.isArray(data.items) ? data.items : [];
}

/** Keeps only the chosen ids, in the admin's order. An id whose entity has
 *  since been deleted simply drops out. */
function pickOrdered<T extends { id: string }>(items: T[], ids: string[] | undefined): T[] | null {
  if (!ids?.length) return null;
  const byId = new Map(items.map((i) => [i.id, i]));
  return ids.map((id) => byId.get(id)).filter((i): i is T => !!i);
}

/** A locale-less storefront path from the admin ("/sale") becomes a real one.
 *  Absolute URLs pass through; blank means "use the section's default". */
function resolveConfigHref(href: string | null | undefined, locale: string): string | undefined {
  const value = href?.trim();
  if (!value) return undefined;
  if (/^https?:\/\//.test(value)) return value;
  return `/${locale}${value.startsWith("/") ? value : `/${value}`}`;
}

/**
 * The admin's layout, or the built-in default when nobody has configured one.
 *
 * An empty table means "never customized", not "an empty home page" — so a
 * fresh install gets a working page and an admin who deliberately switches
 * every section off still gets what they asked for (rows exist, none active,
 * and each disabled section is simply absent from this list).
 */
async function fetchLayout(): Promise<HomeSectionSpec[]> {
  const rows = await fetchJson<HomeSectionSpec[]>("/shop/home-sections", []);
  if (Array.isArray(rows) && rows.length > 0) return rows;
  return DEFAULT_HOME_SECTIONS.map((section, index) => ({ id: `default-${index}`, ...section }));
}

/**
 * Hero slides, or a single slide built from the translation file when none have
 * been authored. The fallback is the exact copy the hero shipped with, so a
 * fresh install still gets a finished hero and the admin page starts from
 * something recognisable rather than a blank carousel.
 */
async function fetchHeroSlides(locale: Locale, t: ReturnType<typeof getTranslations>): Promise<HeroSlide[]> {
  const slides = await fetchJson<HeroSlide[]>(`/shop/hero-slides?lang=${locale}`, []);
  if (Array.isArray(slides) && slides.length > 0) return slides;
  return [
    {
      id: "default",
      imageUrl: null,
      imageAlt: null,
      eyebrow: t.shop.homeHeroEyebrow,
      // The same shape the editor produces, so a fresh install's hero and an
      // authored one render through one code path.
      content: `<h2>${t.shop.homeTitle}</h2><p>${t.shop.homeSubtitle}</p>`,
      ctaLabel: t.shop.homeCta,
      ctaHref: "/collections",
      ctaSecondaryLabel: t.shop.homeCtaSecondary,
      ctaSecondaryHref: "/collections",
    },
  ];
}

/** Same precedence the listing and collection pages use: the most specific
 *  promotion covering this product wins. */
function findMatchingPromotion(promotions: ActivePromotion[], product: ProductListItem): PromotionInfo | null {
  const categoryIds = (product.categories ?? []).map((c) => c.id);
  for (const promo of promotions) {
    const matches =
      promo.scope === "site_wide" ||
      (promo.scope === "category" && promo.linkedCategoryIds.some((id) => categoryIds.includes(id))) ||
      (promo.scope === "product" && promo.linkedProductIds.includes(product.id));
    if (matches) return { name: promo.name, discountType: promo.discountType, discountValue: promo.discountValue };
  }
  return null;
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const t = getTranslations(locale);

  const layout = await fetchLayout();
  const present = (type: HomeSectionType) => layout.some((s) => s.type === type);

  // Only fetch what the configured layout actually renders — switching a section
  // off in admin removes its query too, rather than paying for data nobody sees.
  const railSections = layout.filter((s) => s.type === "product_rail");
  const promoSections = layout.filter((s) => s.type === "promo_banner");
  // The two collection lists are fetched separately rather than filtering one
  // down to the other: the public DTO carries no `isFeatured`, so the full list
  // cannot be narrowed back to the featured set client-side. A page that mixes a
  // hand-picked section with an automatic one genuinely needs both.
  const collectionSections = layout.filter((s) => s.type === "featured_collections");
  const needsFeaturedCollections = collectionSections.some((s) => !s.config.collectionIds?.length);
  // The offer banners resolve their picked collection ids to slugs out of the
  // same full list, so either kind of section is a reason to fetch it.
  const needsAllCollections =
    collectionSections.some((s) => (s.config.collectionIds?.length ?? 0) > 0) ||
    layout.some((s) => s.type === "offer_banners" && (s.config.offerBanners?.length ?? 0) > 0);
  const [heroSlides, categories, featuredCollections, allCollections, promotions, posts, railProducts, promoProducts] = await Promise.all([
    present("hero") ? fetchHeroSlides(locale, t) : [],
    present("categories") ? fetchJson<HomeCategory[]>(`/shop/categories?lang=${locale}`, []) : [],
    needsFeaturedCollections ? fetchJson<HomeCollection[]>(`/shop/collections/featured?lang=${locale}`, []) : [],
    needsAllCollections ? fetchJson<HomeCollection[]>(`/shop/collections?lang=${locale}`, []) : [],
    // The banner needs the promotion list, but so do the rails' per-product
    // badges — fetch it if either kind of section is on the page.
    present("promo_banner") || railSections.length > 0
      ? fetchJson<ActivePromotion[]>(`/shop/promotions/active?lang=${locale}`, [])
      : [],
    present("blog_posts")
      ? fetchJson<{ items?: HomePost[] }>(`/blog/posts?limit=12&lang=${locale}`, {}).then((d) => d.items ?? [])
      : [],
    Promise.all(railSections.map((s) => fetchProducts(s, locale))),
    Promise.all(promoSections.map((s) => fetchPromoProducts(s, locale))),
  ]);

  const productsByRailId = new Map(railSections.map((s, i) => [s.id, railProducts[i] ?? []]));
  const promoProductsBySectionId = new Map(promoSections.map((s, i) => [s.id, promoProducts[i] ?? []]));
  const collectionsById = new Map(allCollections.map((c) => [c.id, c]));
  const promotionFor = (product: ProductListItem) => findMatchingPromotion(promotions, product);

  // Tint alternates across the sections that support a background, so the page
  // keeps its banded rhythm no matter which ones the admin turned off.
  let tintIndex = 0;

  /**
   * Identity for the knowledge panel, and the search box crawlers offer for a
   * site they can search. Home only — repeating Organization on every page
   * says nothing extra and just adds weight.
   */
  const siteJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        // The real asset the header uses — a logo URL that 404s is worse
        // than none at all.
        logo: `${SITE_URL}/assets/logo_silomis_icon.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: locale,
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/${locale}/shop/search?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <main className={styles.page}>
      <JsonLd id="site-jsonld" data={siteJsonLd} />
      {layout.map((section) => {
        switch (section.type) {
          case "hero":
            return <HomeHero key={section.id} slides={heroSlides} locale={locale} />;

          case "trust_bar":
            return <TrustBar key={section.id} t={t} locale={locale} items={section.config.trustItems} />;

          case "categories":
            return (
              <CategoryTiles
                key={section.id}
                categories={
                  // Hand-picked wins, in the admin's order and with no cap.
                  // Otherwise top-level only — subcategory drill-down already
                  // lives in the header nav, and a flat list of every leaf
                  // reads as clutter.
                  pickOrdered(categories, section.config.categoryIds) ??
                  categories.filter((c) => !c.parentId).slice(0, sectionLimit(section))
                }
                locale={locale}
                t={t}
                title={localized(section.config.title, locale) || undefined}
                href={resolveConfigHref(section.config.viewAllHref, locale)}
                tinted={tintIndex++ % 2 === 1}
              />
            );

          case "featured_collections":
            return (
              <FeaturedCollections
                key={section.id}
                collections={
                  // Hand-picked resolves against the full list, since a chosen
                  // collection need not be flagged featured; automatic takes the
                  // featured list, which is already in the admin's sortOrder.
                  pickOrdered(allCollections, section.config.collectionIds) ??
                  featuredCollections.slice(0, sectionLimit(section))
                }
                locale={locale}
                t={t}
                title={localized(section.config.title, locale) || undefined}
                subtitle={localized(section.config.subtitle, locale) || undefined}
                href={resolveConfigHref(section.config.viewAllHref, locale)}
                tinted={tintIndex++ % 2 === 1}
              />
            );

          case "offer_banners":
            return (
              <OfferBanners
                key={section.id}
                banners={section.config.offerBanners ?? []}
                targets={collectionsById}
                locale={locale}
                t={t}
                title={localized(section.config.title, locale) || undefined}
                subtitle={localized(section.config.subtitle, locale) || undefined}
                tinted={tintIndex++ % 2 === 1}
              />
            );

          case "product_rail": {
            const source = section.config.source ?? "newest";
            const defaultHref =
              source === "on_sale" ? `/${locale}/sale` : `/${locale}/collections`;
            return (
              <ProductRail
                key={section.id}
                title={
                  localized(section.config.title, locale) ||
                  (source === "featured" ? t.shop.homeFeaturedTitle : t.shop.homeNewArrivalsTitle)
                }
                products={productsByRailId.get(section.id) ?? []}
                href={resolveConfigHref(section.config.viewAllHref, locale) ?? defaultHref}
                locale={locale}
                t={t}
                promotionFor={promotionFor}
                tinted={tintIndex++ % 2 === 1}
              />
            );
          }

          case "promo_banner": {
            return (
              <PromoProductsCarousel
                key={section.id}
                title={localized(section.config.title, locale) || t.shop.homePromoTitle}
                products={promoProductsBySectionId.get(section.id) ?? []}
                // Fixed destination: this band exists to funnel to the sale
                // listing, and pointing it anywhere else would leave the rest
                // of the reduced catalogue with no entry point.
                href={`/${locale}/sale`}
                locale={locale}
                t={t}
                promotionFor={promotionFor}
              />
            );
          }

          // The editorial blocks render nothing but the admin's own copy, so
          // they need no data and no fetch above.
          case "section_heading":
            // Deliberately outside the tint rotation: a chapter title has to
            // share a band with whatever it introduces, so it paints its own.
            return <SectionHeading key={section.id} config={section.config} locale={locale} />;

          case "separator":
            // Consuming a tint slot is the point of `flipTint` — it is how an
            // admin decides where the next white / off-white band starts.
            if (section.config.flipTint) tintIndex++;
            return <SectionSeparator key={section.id} config={section.config} />;

          case "seo_text":
            return (
              <SeoText key={section.id} config={section.config} locale={locale} tinted={tintIndex++ % 2 === 1} />
            );

          case "faqs":
            return <Faqs key={section.id} config={section.config} locale={locale} t={t} tinted={tintIndex++ % 2 === 1} />;

          case "blog_posts":
            return (
              <BlogTeasers
                key={section.id}
                posts={posts.slice(0, sectionLimit(section))}
                locale={locale}
                t={t}
                title={localized(section.config.title, locale) || undefined}
                href={resolveConfigHref(section.config.viewAllHref, locale)}
                tinted={tintIndex++ % 2 === 1}
              />
            );

          default:
            // An unknown type means the DB is ahead of this build — skip it
            // rather than crashing the whole page.
            return null;
        }
      })}
    </main>
  );
}
