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
  "blog_posts",
  "section_heading",
  "separator",
  "seo_text",
] as const;

export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number];

export type ProductRailSource = "newest" | "featured";

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
  /** Item count for the list-bearing sections. */
  limit?: number;
  /** product_rail only: which catalogue query feeds it. */
  source?: ProductRailSource;
  /** product_rail only: heading override in the admin's own words, per locale;
   *  falls back to the built-in translated default when left empty. */
  title?: LocalizedText | null;

  // ── section_heading / seo_text ──
  /** Small line above the heading ("New in", "Our pick"). */
  eyebrow?: LocalizedText;
  /** The H2 itself. */
  heading?: LocalizedText;
  /** One-line lead under the heading. */
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
