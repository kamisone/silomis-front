/**
 * The contract between the admin's home-page layout and the section components.
 *
 * Mirrors HOME_SECTION_TYPES / DEFAULT_HOME_SECTIONS in the backend DTO. The
 * backend deliberately keeps `config` permissive — this file is where each
 * type's real shape lives, so adding an option to a section is a frontend
 * change only.
 */

import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n";

export const HOME_SECTION_TYPES = [
  "hero",
  "trust_bar",
  "categories",
  "featured_collections",
  "product_rail",
  "promo_banner",
  "offer_banners",
  "blog_posts",
  "section_heading",
  "separator",
  "seo_text",
] as const;

export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number];

export type ProductRailSource = "newest" | "featured" | "on_sale" | "manual";

/** One reassurance in the trust bar. `icon` names a lucide icon from the same
 *  set the product trust badges use, so the two stay visually consistent. */
export interface TrustBarItem {
  id: string;
  icon: string;
  label?: LocalizedText;
  sub?: LocalizedText;
}

/**
 * One picture in the "En ce moment" grid: an image that opens a collection, with
 * a button printed over it. Which cell it fills is its position in the list.
 *
 * The image URL is stored beside its key for the same reason the chapter
 * heading's icon is — `media/` objects resolve to stable public CDN URLs that
 * never expire, so the storefront can print one without a round-trip and the
 * backend keeps treating config as opaque.
 */
export interface OfferBanner {
  id: string;
  imageKey?: string | null;
  imageUrl?: string | null;
  /** Optional taller crop for phones. Absent means the desktop image is used at
   *  both sizes, which is fine for a picture that is already fairly square. */
  mobileImageKey?: string | null;
  mobileImageUrl?: string | null;
  /** The collection this banner opens. */
  collectionId?: string | null;
  /** Button copy; empty falls back to the translated "Discover". */
  ctaLabel?: LocalizedText;
}

/**
 * The five cells of the offer-banner grid, in the order they are configured.
 *
 * Two columns by three rows: the first picture stands tall down the left across
 * rows 1 and 2, two short ones stack beside it, and a further two sit side by
 * side along the bottom.
 *
 *   ┌───────────┬───────────┐
 *   │           │  topRight │
 *   │   tall    ├───────────┤
 *   │           │ midRight  │
 *   ├───────────┼───────────┤
 *   │ bottomL   │ bottomR   │
 *   └───────────┴───────────┘
 */
export const OFFER_SLOTS = ["tall", "topRight", "midRight", "bottomLeft", "bottomRight"] as const;

/**
 * Copy the admin typed, keyed by locale.
 *
 * The editorial blocks own no database columns of their own — their text lives
 * inside the section's JSON config — so they carry their translations with them
 * instead of going through the EntityTranslation table. A plain string is
 * accepted too, for configs written before this shape existed.
 */
export type LocalizedText = Partial<Record<Locale, string>> | string;

/**
 * Best available text for `locale`: the exact locale, then English, then any
 * locale that has something. A block that has only been translated into two
 * languages still renders in the other five rather than leaving a gap where a
 * heading should be.
 */
export function localized(text: LocalizedText | null | undefined, locale: Locale): string {
  if (!text) return "";
  if (typeof text === "string") return text.trim();
  const exact = text[locale]?.trim();
  if (exact) return exact;
  const base = text[DEFAULT_LOCALE]?.trim();
  if (base) return base;
  for (const l of LOCALES) {
    const value = text[l]?.trim();
    if (value) return value;
  }
  return "";
}

/** True when nothing has been typed in any locale — used to hide an empty block. */
export function isEmptyText(text: LocalizedText | null | undefined): boolean {
  if (!text) return true;
  if (typeof text === "string") return text.trim() === "";
  return !LOCALES.some((l) => text[l]?.trim());
}

export type SectionAlign = "left" | "center";
export type SeparatorTone = "plain" | "tint" | "line";
export type SeparatorHeight = "sm" | "md" | "lg";

export interface HomeSectionConfig {
  /** Item count for the list-bearing sections. Ignored when the section is
   *  hand-picked — the chosen list is the list. */
  limit?: number;
  /** product_rail only: which catalogue query feeds it. */
  source?: ProductRailSource;
  /** Heading override in the admin's own words, per locale; falls back to the
   *  built-in translated default when left empty. Used by every list section. */
  title?: LocalizedText | null;

  /**
   * Hand-picked contents, in the admin's own order.
   *
   * Empty or absent means "let the section's own query decide" — which is the
   * default for every list section, so a fresh block still fills itself.
   */
  productIds?: string[];
  categoryIds?: string[];
  collectionIds?: string[];

  /** promo_banner only: a specific promotion, or null for the highest-priority
   *  active one. A pinned promotion that stops being active falls back too,
   *  rather than leaving an empty band. */
  promotionId?: string | null;

  /** trust_bar only: the reassurances, in order. Absent means the built-in four. */
  trustItems?: TrustBarItem[];

  /**
   * offer_banners only: the five pictures, in slot order — see OFFER_SLOTS.
   *
   * Position in this list *is* the position in the grid, so a picture left out
   * leaves its cell empty rather than promoting the next one. Empty altogether
   * means the section renders nothing: there is no automatic source behind it,
   * so an unconfigured block has nothing to show and should not leave a
   * stranded heading on the page.
   */
  offerBanners?: OfferBanner[];

  /** List sections: where the "view all" link goes. Locale-less storefront
   *  path; absent means the section's own default destination. */
  viewAllHref?: string | null;

  // ── section_heading / seo_text ──
  /** Small line above the heading ("New in", "Our pick"). */
  eyebrow?: LocalizedText;
  /** The H2 itself. */
  heading?: LocalizedText;
  /**
   * One-line lead under the heading. Used by the chapter heading and by
   * featured_collections, whose subtitle used to be a fixed translated string.
   *
   * Empty in every locale means no subtitle at all — the section renders its
   * heading alone rather than falling back to built-in copy, because a line the
   * admin deleted should stay deleted.
   */
  subtitle?: LocalizedText;
  /** seo_text only: long-form HTML from the rich-text editor. */
  body?: LocalizedText;
  /** section_heading only. Default "left", matching the rails' heading rhythm. */
  align?: SectionAlign;
  /**
   * section_heading only: paint the tinted band behind it.
   *
   * Explicit rather than part of the automatic alternation, because a chapter
   * title has to sit on the *same* band as the section it introduces — letting
   * it take its own turn in the rotation is exactly what would detach it.
   */
  tinted?: boolean;
  /**
   * section_heading only: small image printed inline before the heading.
   * The URL is stored alongside the key because `media/` objects resolve to
   * stable public CDN URLs that never expire — so the storefront needs no
   * round-trip to render one, and the backend keeps treating config as opaque.
   */
  iconImageKey?: string | null;
  iconImageUrl?: string | null;

  // ── separator ──
  /** Which treatment the spacer uses. Default "plain". */
  tone?: SeparatorTone;
  /** How much air it inserts. Default "md". */
  height?: SeparatorHeight;
  /**
   * separator only: flip the white/tinted alternation from here down, so the
   * admin can decide where a new chapter's banding starts instead of inheriting
   * whatever parity the sections above happened to leave behind.
   */
  flipTint?: boolean;
}

export interface HomeSectionSpec {
  id: string;
  type: HomeSectionType;
  config: HomeSectionConfig;
}

/**
 * What the storefront renders when the home_sections table is empty — i.e. before
 * anyone has opened the admin page. Kept identical to the backend's
 * DEFAULT_HOME_SECTIONS so "restore defaults" reproduces exactly this page.
 *
 * The editorial blocks are deliberately absent: they render the admin's copy and
 * nothing else, so a default one would be a blank band on a fresh install.
 */
export const DEFAULT_HOME_SECTIONS: Array<{ type: HomeSectionType; config: HomeSectionConfig }> = [
  { type: "hero", config: {} },
  { type: "trust_bar", config: {} },
  { type: "categories", config: { limit: 6 } },
  { type: "featured_collections", config: { limit: 3 } },
  { type: "product_rail", config: { source: "newest", limit: 8 } },
  { type: "promo_banner", config: {} },
  { type: "product_rail", config: { source: "featured", limit: 8 } },
  { type: "blog_posts", config: { limit: 3 } },
];

/** Per-type defaults, used when a config field is absent. */
export const SECTION_DEFAULT_LIMIT: Partial<Record<HomeSectionType, number>> = {
  categories: 6,
  featured_collections: 3,
  product_rail: 8,
  blog_posts: 3,
};

export function sectionLimit(section: HomeSectionSpec): number {
  return section.config.limit ?? SECTION_DEFAULT_LIMIT[section.type] ?? 8;
}

/** The config a freshly added section starts with, so a new block lands on the
 *  page looking like something rather than like a bug. */
export function newSectionConfig(type: HomeSectionType): HomeSectionConfig {
  const limit = SECTION_DEFAULT_LIMIT[type];
  if (limit) return { limit };
  if (type === "separator") return { tone: "plain", height: "md" };
  return {};
}

/**
 * Sections that draw no data of their own. The storefront skips every catalogue
 * query for these, and the admin card shows copy fields instead of item counts.
 */
export const EDITORIAL_SECTION_TYPES = ["section_heading", "separator", "seo_text"] as const;

export type SectionField =
  | "limit"
  | "source"
  | "products"
  | "categories"
  | "collections"
  | "promotion"
  | "trustItems"
  | "offerBanners"
  | "viewAll"
  | "title"
  | "eyebrow"
  | "heading"
  | "subtitle"
  | "body"
  | "align"
  | "tinted"
  | "icon"
  | "tone"
  | "height"
  | "flipTint";

/** Admin-facing metadata: label, blurb, and which config fields to show. */
export const SECTION_META: Record<
  HomeSectionType,
  { label: string; description: string; fields: SectionField[] }
> = {
  hero: {
    label: "Hero",
    description: "Headline, sub-headline and the two main call-to-action buttons.",
    fields: [],
  },
  trust_bar: {
    label: "Trust bar",
    description: "Delivery, returns, secure payment and support reassurances. Leave the list empty to keep the built-in four.",
    fields: ["trustItems"],
  },
  categories: {
    label: "Shop by category",
    description: "Picture tiles. Top-level categories by default, or exactly the ones you choose.",
    fields: ["title", "categories", "limit", "viewAll"],
  },
  featured_collections: {
    label: "Featured collections",
    description: "Collections flagged as featured, or exactly the ones you choose, in your order.",
    fields: ["title", "subtitle", "collections", "limit", "viewAll"],
  },
  product_rail: {
    label: "Product rail",
    description: "A scrollable row of products, with an add-to-cart on every card. Newest, featured, on sale — or a list you pick by hand.",
    fields: ["title", "source", "products", "limit", "viewAll"],
  },
  promo_banner: {
    label: "Promotion banner",
    description: "A promotion, full width. The highest-priority active one by default, or a specific one you pin.",
    fields: ["promotion"],
  },
  offer_banners: {
    label: "Offer banners",
    description: "A five-picture grid — one tall, two beside it, two along the bottom — each opening a collection through its own button.",
    fields: ["title", "subtitle", "offerBanners"],
  },
  blog_posts: {
    label: "Blog posts",
    description: "The latest published articles.",
    fields: ["title", "limit", "viewAll"],
  },
  section_heading: {
    label: "Chapter heading",
    description: "A standalone title that names the block underneath it — how the page reads as chapters rather than one long stack.",
    fields: ["eyebrow", "heading", "subtitle", "icon", "align", "tinted"],
  },
  separator: {
    label: "Separator",
    description: "Breathing room between chapters, and where the white / off-white banding restarts.",
    fields: ["tone", "height", "flipTint"],
  },
  seo_text: {
    label: "SEO text",
    description: "Long-form copy for the bottom of the page. Mostly for search engines — set in quieter type than the rest of the page.",
    fields: ["heading", "body"],
  },
};
