/**
 * The contract between the admin's home-page layout and the section components.
 *
 * Mirrors HOME_SECTION_TYPES / DEFAULT_HOME_SECTIONS in the backend DTO. The
 * backend deliberately keeps `config` permissive — this file is where each
 * type's real shape lives, so adding an option to a section is a frontend
 * change only.
 */

export const HOME_SECTION_TYPES = [
  "hero",
  "trust_bar",
  "categories",
  "featured_collections",
  "product_rail",
  "promo_banner",
  "blog_posts",
] as const;

export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number];

export type ProductRailSource = "newest" | "featured";

export interface HomeSectionConfig {
  /** Item count for the list-bearing sections. */
  limit?: number;
  /** product_rail only: which catalogue query feeds it. */
  source?: ProductRailSource;
  /** product_rail only: plain-text heading override; falls back to the localized default. */
  title?: string | null;
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

/** Admin-facing metadata: label, blurb, and which config fields to show. */
export const SECTION_META: Record<
  HomeSectionType,
  { label: string; description: string; fields: Array<"limit" | "source" | "title"> }
> = {
  hero: {
    label: "Hero",
    description: "Headline, sub-headline and the two main call-to-action buttons.",
    fields: [],
  },
  trust_bar: {
    label: "Trust bar",
    description: "Delivery, returns, secure payment and support reassurances.",
    fields: [],
  },
  categories: {
    label: "Shop by category",
    description: "Picture tiles for the top-level categories.",
    fields: ["limit"],
  },
  featured_collections: {
    label: "Featured collections",
    description: "Collections flagged as featured, in their own sort order.",
    fields: ["limit"],
  },
  product_rail: {
    label: "Product rail",
    description: "A scrollable row of products, with an add-to-cart on every card.",
    fields: ["source", "title", "limit"],
  },
  promo_banner: {
    label: "Promotion banner",
    description: "The highest-priority active promotion, full width.",
    fields: [],
  },
  blog_posts: {
    label: "Blog posts",
    description: "The latest published articles.",
    fields: ["limit"],
  },
};
