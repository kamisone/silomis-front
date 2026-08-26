"use client";

import { AlignCenter, AlignLeft, Minus, Plus, Sparkles, Star, Tag, X } from "lucide-react";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import EntityPicker, { type PickerOption } from "@/components/admin/ui/EntityPicker";
import Select, { type SelectOption } from "@/components/admin/ui/Select";
import Segmented from "@/components/admin/ui/Segmented";
import Switch from "@/components/admin/ui/Switch";
import TrustBadgeIconSelect from "@/components/admin/shop/TrustBadgeIconSelect";
import type { TrustBadgeIconName } from "@/lib/shop/productContent.types";
import ui from "@/components/admin/ui/admin-ui.module.css";
import {
  SECTION_DEFAULT_LIMIT,
  SECTION_META,
  type HomeSectionConfig,
  type HomeSectionType,
  type ProductRailSource,
  type SectionField,
} from "@/components/home/sectionTypes";
import LocalizedTextField from "@/components/admin/ui/LocalizedTextField";
import type { TrustBarItem } from "@/components/home/sectionTypes";
import styles from "./HomeSections.module.css";

// Every text field on this page is ordinary copy, so one endpoint serves them
// all — plain fields post `{ text }`, the rich-text body posts `{ html }`.
const TRANSLATE_TEXT = "/next-api/admin/shop/home-sections/sections/text/translate";
const TRANSLATE_HTML = "/next-api/admin/shop/home-sections/sections/html/translate";

// ── What the pickers choose from ─────────────────────────────────────────────

export interface CatalogueProduct { id: string; title: string; sku?: string | null; featuredImageUrl?: string | null }
export interface CatalogueCategory { id: string; name: string; parentId?: string | null }
export interface CatalogueCollection { id: string; name: string; slug?: string | null; isActive?: boolean }
export interface CataloguePromotion { id: string; name: string; isActive?: boolean; trigger?: string; scope?: string }

export interface Catalogue {
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
  collections: CatalogueCollection[];
  promotions: CataloguePromotion[];
}

export const EMPTY_CATALOGUE: Catalogue = { products: [], categories: [], collections: [], promotions: [] };

/** Ids are stable; the labels beside them are whatever the catalogue call
 *  returned, so a picker still works when that call failed. */
function productOptions(items: CatalogueProduct[]): PickerOption[] {
  return items.map((p) => ({ id: p.id, label: p.title, sublabel: p.sku || null, imageUrl: p.featuredImageUrl ?? null }));
}

function categoryOptions(items: CatalogueCategory[]): PickerOption[] {
  const byId = new Map(items.map((c) => [c.id, c]));
  return items.map((c) => ({
    id: c.id,
    label: c.name,
    // Two categories can share a name under different parents; the parent is
    // what tells them apart.
    sublabel: c.parentId ? (byId.get(c.parentId)?.name ?? null) : "Top level",
  }));
}

/** The rail sources, each with the sentence a native <option> had nowhere to
 *  put — "Hand-picked" behaves very differently from the other three. */
const SOURCE_OPTIONS: SelectOption<ProductRailSource>[] = [
  { value: "newest", label: "Newest first", description: "The most recently published products.", icon: <Sparkles size={14} strokeWidth={2} /> },
  { value: "featured", label: "Featured products", description: "Products flagged as featured in the catalogue.", icon: <Star size={14} strokeWidth={2} /> },
  { value: "on_sale", label: "On sale", description: "Products covered by an active automatic promotion.", icon: <Tag size={14} strokeWidth={2} /> },
  { value: "manual", label: "Hand-picked", description: "Exactly the products you choose, in your order.", icon: <Plus size={14} strokeWidth={2} /> },
];

// ── Layout primitives ────────────────────────────────────────────────────────

/**
 * One labelled control on the settings grid.
 *
 * `span` is what keeps the panel aligned: fields declare how much of the
 * two-column grid they need rather than being left to wrap wherever they land,
 * which is what made the old single flex row look accidental.
 */
function Field({
  label,
  hint,
  span = "half",
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  span?: "half" | "full" | "narrow";
  children: React.ReactNode;
}) {
  const spanClass = span === "full" ? styles.fieldFull : span === "narrow" ? styles.fieldNarrow : "";
  return (
    <div className={`${styles.field} ${spanClass}`}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </div>
  );
}

/** A titled band inside the settings panel. The rule and the label are the
 *  separation the panel was missing — without them every control read as
 *  equally important and equally unrelated. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>
        <span>{title}</span>
        <span className={styles.groupRule} aria-hidden="true" />
      </h3>
      <div className={styles.grid}>{children}</div>
    </section>
  );
}

/** Small −/+ stepper. The native number spinners are tiny, differ per browser,
 *  and sit at the wrong end of the field; these are real targets. */
function Stepper({
  value,
  min = 1,
  max = 24,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.stepperBtn}
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="One fewer"
      >
        <Minus size={13} strokeWidth={2.75} />
      </button>
      <input
        className={styles.stepperInput}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
        disabled={disabled}
      />
      <button
        type="button"
        className={styles.stepperBtn}
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="One more"
      >
        <Plus size={13} strokeWidth={2.75} />
      </button>
    </div>
  );
}

// Which group each control belongs to. Content is what the section shows,
// Appearance is how it looks, Link is where it sends people.
const APPEARANCE_FIELDS: SectionField[] = ["icon", "align", "tinted", "tone", "height", "flipTint"];
const LINK_FIELDS: SectionField[] = ["viewAll"];

/**
 * The settings panel for one section.
 *
 * Split out of the page because the page is about ordering sections and this is
 * about configuring one. Every control writes through `onChange`, which the page
 * merges into the section's config and PATCHes — the same save-as-you-leave-the-
 * field contract the numeric fields always had.
 */
export default function SectionSettings({
  type,
  config,
  catalogue = EMPTY_CATALOGUE,
  saving,
  onChange,
}: {
  type: HomeSectionType;
  config: HomeSectionConfig;
  catalogue?: Catalogue;
  saving: boolean;
  onChange: (patch: Partial<HomeSectionConfig>) => void;
}) {
  const fields = SECTION_META[type].fields;
  if (fields.length === 0) return null;

  const has = (f: SectionField) => fields.includes(f);
  const source: ProductRailSource = config.source ?? "newest";
  // A hand-picked list *is* the list — an "items" cap beside it would only ever
  // truncate what the admin deliberately chose.
  const hasManualList =
    (source === "manual" && has("products")) ||
    (has("categories") && (config.categoryIds?.length ?? 0) > 0) ||
    (has("collections") && (config.collectionIds?.length ?? 0) > 0);
  const trustItems = config.trustItems ?? [];

  // The storefront's banner reads /shop/promotions/active, which returns only
  // automatic-trigger promotions — so offering a code-triggered one here would
  // be a setting that silently never takes effect.
  const bannerPromotions = catalogue.promotions.filter((p) => (p.trigger ?? "automatic") === "automatic");
  const pinnedMissing = !!config.promotionId && !bannerPromotions.some((p) => p.id === config.promotionId);
  const promotionOptions: SelectOption<string>[] = [
    { value: "", label: "Automatic", description: "The highest-priority active promotion." },
    ...bannerPromotions.map((p) => ({
      value: p.id,
      label: p.name,
      description: p.isActive === false ? "Currently inactive — the banner falls back." : undefined,
    })),
    // A promotion pinned before it was switched to a code — or before this
    // filter existed — would otherwise vanish from its own select and read as
    // "Automatic", quietly losing the setting.
    ...(pinnedMissing
      ? [
          {
            value: config.promotionId as string,
            label: catalogue.promotions.find((p) => p.id === config.promotionId)?.name ?? "Pinned promotion",
            description: "No longer eligible for the banner.",
          },
        ]
      : []),
  ];

  function setTrustItems(next: TrustBarItem[]) {
    onChange({ trustItems: next });
  }
  function patchTrustItem(id: string, patch: Partial<TrustBarItem>) {
    setTrustItems(trustItems.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  const showAppearance = APPEARANCE_FIELDS.some(has);
  const showLink = LINK_FIELDS.some(has);

  return (
    <div className={styles.settings}>
      <Group title="Content">
        {has("title") && (
          <Field label="Heading" span="full">
            <LocalizedTextField
              label="Heading"
              hideLabel
              value={config.title}
              onCommit={(title) => onChange({ title })}
              placeholder="Leave blank for the translated default"
              translateEndpoint={TRANSLATE_TEXT}
              // The one config field the API length-checks; capped here so a
              // long heading is stopped at the keystroke rather than the save.
              maxLength={120}
              disabled={saving}
            />
          </Field>
        )}

        {has("source") && (
          <Field label="Fill with">
            <Select
              value={source}
              options={SOURCE_OPTIONS}
              onChange={(next) => onChange({ source: next })}
              ariaLabel="Fill the rail with"
              disabled={saving}
            />
          </Field>
        )}

        {has("limit") && !hasManualList && (
          <Field label="How many" span="narrow">
            <Stepper
              value={config.limit ?? SECTION_DEFAULT_LIMIT[type] ?? 8}
              onChange={(limit) => onChange({ limit })}
              disabled={saving}
              ariaLabel="Number of items"
            />
          </Field>
        )}

        {/* Only meaningful once the rail is hand-picked — offering a product list
            beside "Newest first" would imply the two combine, and they do not. */}
        {has("products") && source === "manual" && (
          <div className={styles.fieldFull}>
            <EntityPicker
              label="Products"
              hint="Shown in this order. Search by name or SKU."
              options={productOptions(catalogue.products)}
              value={config.productIds ?? []}
              onChange={(productIds) => onChange({ productIds })}
              placeholder="Search products…"
              emptyLabel="No products picked yet — the rail will render empty until you add some."
              loading={catalogue.products.length === 0}
              disabled={saving}
            />
          </div>
        )}

        {has("categories") && (
          <div className={styles.fieldFull}>
            <EntityPicker
              label="Categories"
              hint="Leave empty to show the top-level categories automatically."
              options={categoryOptions(catalogue.categories)}
              value={config.categoryIds ?? []}
              onChange={(categoryIds) => onChange({ categoryIds })}
              placeholder="Search categories…"
              emptyLabel="Auto — the top-level categories, newest first."
              loading={catalogue.categories.length === 0}
              disabled={saving}
            />
          </div>
        )}

        {has("collections") && (
          <div className={styles.fieldFull}>
            <EntityPicker
              label="Collections"
              hint="Leave empty to show whichever collections are flagged as featured."
              options={catalogue.collections.map((c) => ({
                id: c.id,
                label: c.name,
                sublabel: c.isActive === false ? "Inactive" : (c.slug ?? null),
              }))}
              value={config.collectionIds ?? []}
              onChange={(collectionIds) => onChange({ collectionIds })}
              placeholder="Search collections…"
              emptyLabel="Auto — the featured collections, in their own order."
              loading={catalogue.collections.length === 0}
              disabled={saving}
            />
          </div>
        )}

        {has("promotion") && (
          <Field
            label="Promotion"
            span="full"
            hint="Only automatic promotions are listed: a coupon-code one has nothing to show until the code is typed at checkout. A pinned promotion that expires falls back to the automatic pick, so the band never goes blank."
          >
            <Select
              value={config.promotionId ?? ""}
              options={promotionOptions}
              onChange={(next) => onChange({ promotionId: next || null })}
              ariaLabel="Promotion to show"
              disabled={saving}
            />
          </Field>
        )}

        {has("eyebrow") && (
          <Field label="Eyebrow" span="full">
            <LocalizedTextField
              label="Eyebrow"
              hideLabel
              value={config.eyebrow}
              onCommit={(eyebrow) => onChange({ eyebrow })}
              translateEndpoint={TRANSLATE_TEXT}
              placeholder="New this season"
              disabled={saving}
            />
          </Field>
        )}

        {has("heading") && (
          <Field label={type === "seo_text" ? "Heading" : "Title"} span="full">
            <LocalizedTextField
              label={type === "seo_text" ? "Heading" : "Title"}
              hideLabel
              value={config.heading}
              onCommit={(heading) => onChange({ heading })}
              translateEndpoint={TRANSLATE_TEXT}
              placeholder={type === "seo_text" ? "About our collection" : "Our favourites right now"}
              disabled={saving}
            />
          </Field>
        )}

        {has("subtitle") && (
          <Field label="Subtitle" span="full">
            <LocalizedTextField
              label="Subtitle"
              hideLabel
              value={config.subtitle}
              onCommit={(subtitle) => onChange({ subtitle })}
              translateEndpoint={TRANSLATE_TEXT}
              placeholder="One line of context under the title"
              multiline
              disabled={saving}
            />
          </Field>
        )}

        {has("body") && (
          <Field
            label="Body"
            span="full"
            hint="Written for search engines as much as for readers — a few paragraphs about what you sell, with the words customers actually search for."
          >
            <LocalizedTextField
              label="Body"
              hideLabel
              value={config.body}
              onCommit={(body) => onChange({ body })}
              translateEndpoint={TRANSLATE_HTML}
              richText
              disabled={saving}
            />
          </Field>
        )}

        {has("trustItems") && (
          <div className={styles.fieldFull}>
            <div className={styles.trustHead}>
              <span className={styles.fieldLabel}>Reassurances</span>
              <button
                type="button"
                className={styles.trustAdd}
                onClick={() =>
                  setTrustItems([
                    ...trustItems,
                    { id: `t${Date.now().toString(36)}`, icon: "ShieldCheck", label: {}, sub: {} },
                  ])
                }
                disabled={saving || trustItems.length >= 6}
              >
                <Plus size={13} strokeWidth={2.5} />
                Add
              </button>
            </div>

            {trustItems.length === 0 ? (
              <p className={styles.trustEmpty}>
                Using the built-in four — free delivery, easy returns, secure payment, and support. Add one to take the
                row over; you then own all of it.
              </p>
            ) : (
              <ol className={styles.trustList}>
                {trustItems.map((item, i) => (
                  <li key={item.id} className={styles.trustItem}>
                    <div className={styles.trustItemHead}>
                      <span className={styles.trustRank}>{i + 1}</span>
                      <TrustBadgeIconSelect
                        value={item.icon as TrustBadgeIconName}
                        onChange={(icon) => patchTrustItem(item.id, { icon })}
                      />
                      <button
                        type="button"
                        className={styles.trustRemove}
                        onClick={() => setTrustItems(trustItems.filter((it) => it.id !== item.id))}
                        disabled={saving}
                        aria-label="Remove reassurance"
                      >
                        <X size={13} strokeWidth={2.4} />
                      </button>
                    </div>
                    <div className={styles.trustFields}>
                      <LocalizedTextField
                        label="Label"
                        value={item.label}
                        onCommit={(label) => patchTrustItem(item.id, { label })}
                        placeholder="Free delivery"
                        translateEndpoint={TRANSLATE_TEXT}
                        disabled={saving}
                      />
                      <LocalizedTextField
                        label="Under it"
                        value={item.sub}
                        onCommit={(sub) => patchTrustItem(item.id, { sub })}
                        placeholder="On eligible orders"
                        translateEndpoint={TRANSLATE_TEXT}
                        disabled={saving}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Group>

      {showAppearance && (
        <Group title="Appearance">
          {has("icon") && (
            <Field label="Icon" span="full">
              <div className={styles.iconRow}>
                <MediaPicker
                  value={config.iconImageKey ?? null}
                  previewUrl={config.iconImageUrl ?? null}
                  mediaType="image"
                  label="heading icon"
                  asAddTile
                  className={styles.iconTile}
                  // The URL is stored next to the key so the storefront can
                  // print it without a lookup — media/ objects are public and
                  // never expire.
                  onChange={(storageKey, url) => onChange({ iconImageKey: storageKey, iconImageUrl: url })}
                />
                <span className={styles.iconHint}>
                  Optional. A small square mark printed just before the title — a badge or an emoji exported as an
                  image. Sized to the text, so anything above roughly 96&nbsp;px square is enough.
                </span>
              </div>
            </Field>
          )}

          {has("align") && (
            <Field label="Alignment">
              <Segmented
                value={config.align ?? "left"}
                options={[
                  { value: "left", label: "Left", icon: <AlignLeft size={13} strokeWidth={2.25} /> },
                  { value: "center", label: "Centred", icon: <AlignCenter size={13} strokeWidth={2.25} /> },
                ]}
                onChange={(align) => onChange({ align })}
                ariaLabel="Alignment"
                disabled={saving}
              />
            </Field>
          )}

          {has("tone") && (
            <Field label="Style">
              <Segmented
                value={config.tone ?? "plain"}
                options={[
                  { value: "plain", label: "Space" },
                  { value: "tint", label: "Tinted" },
                  { value: "line", label: "Rule" },
                ]}
                onChange={(tone) => onChange({ tone })}
                ariaLabel="Separator style"
                disabled={saving}
              />
            </Field>
          )}

          {has("height") && (
            <Field label="Height">
              <Segmented
                value={config.height ?? "md"}
                options={[
                  { value: "sm", label: "S", title: "Small" },
                  { value: "md", label: "M", title: "Medium" },
                  { value: "lg", label: "L", title: "Large" },
                ]}
                onChange={(height) => onChange({ height })}
                ariaLabel="Separator height"
                disabled={saving}
              />
            </Field>
          )}

          {has("tinted") && (
            <div className={styles.fieldFull}>
              <Switch
                label="Tinted background"
                hint="Match this to the section underneath, so the title and what it introduces sit on the same band."
                checked={!!config.tinted}
                onChange={(tinted) => onChange({ tinted })}
                disabled={saving}
              />
            </div>
          )}

          {has("flipTint") && (
            <div className={styles.fieldFull}>
              <Switch
                label="Restart the banding here"
                hint="The page alternates white and off-white down the sections. Turn this on to flip the order from this point down — the fix when a chapter starts on the wrong shade."
                checked={!!config.flipTint}
                onChange={(flipTint) => onChange({ flipTint })}
                disabled={saving}
              />
            </div>
          )}
        </Group>
      )}

      {showLink && (
        <Group title="Link">
          <Field
            label="“View all” goes to"
            span="full"
            hint={
              <>
                A storefront path without the language prefix — <code className={styles.code}>/shop</code>,{" "}
                <code className={styles.code}>/sale</code>, <code className={styles.code}>/collections/summer</code>.
              </>
            }
          >
            <input
              className={ui.input}
              defaultValue={config.viewAllHref ?? ""}
              placeholder="Leave blank for this section's usual destination"
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value === (config.viewAllHref ?? "")) return;
                onChange({ viewAllHref: value || null });
              }}
              disabled={saving}
            />
          </Field>
        </Group>
      )}
    </div>
  );
}
