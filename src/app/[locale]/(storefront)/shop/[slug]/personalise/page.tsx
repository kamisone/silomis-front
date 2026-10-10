import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PersonalizationEditor from "./PersonalizationEditor";
import type { EditorConfig } from "@/lib/shop/embroidery";
import { isValidLocale, DEFAULT_LOCALE, getTranslations } from "@/lib/i18n";

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
  /**
   * `v` carries the variant the customer was already looking at on the PDP.
   * `line` is a plain basket line to embroider instead of adding a new one —
   * the offer in the drawer, the basket and checkout's first step — and
   * `from`/`return` say where to go back to afterwards. `qty` is the quantity
   * chosen on the PDP; whether those items share one design is asked on the
   * editor's Positions step.
   */
  searchParams: Promise<{ v?: string; line?: string; from?: string; return?: string; edit?: string; qty?: string }>;
}

/** Where a basket-line edit returns to. Only same-site paths are honoured. */
function lineReturn(locale: string, slug: string, from: string | undefined, ret: string | undefined): { href: string; openDrawer: boolean; isCheckout: boolean } {
  if (from === "checkout") return { href: `/${locale}/shop/checkout`, openDrawer: false, isCheckout: true };
  if (from === "cart") return { href: `/${locale}/shop/cart`, openDrawer: false, isCheckout: false };
  // The drawer floats over whatever page it was opened on: go back there and
  // reopen it. Not back into an editor, though — that page is a tool, not a
  // place, so the product page stands in for it.
  const safe = ret && ret.startsWith("/") && !ret.startsWith("//") && !ret.includes("/personalise") ? ret : `/${locale}/shop/${slug}`;
  return { href: safe, openDrawer: true, isCheckout: false };
}

function langParam(locale: string): string {
  return locale !== DEFAULT_LOCALE ? `?lang=${locale}` : "";
}

interface EditorVariant {
  id: string;
  title: string;
  priceCents: number | null;
  isDefault?: boolean;
  options?: { displayValue: string | null; value: string }[];
}

interface EditorProduct {
  id: string;
  slug: string;
  title: string;
  featuredImageUrl: string | null;
  basePriceCents: number;
  personalizationTemplateId: string | null;
  variants?: EditorVariant[];
  upsellingEnabled?: boolean;
  upsellTiers?: { quantity: number; unitPriceCents: number; active?: boolean }[];
}

/**
 * Which variant is being personalised.
 *
 * Priority: the one the customer was looking at when they left the PDP, then
 * the product's declared default, then the first. A design is embroidered onto
 * a specific cap, so guessing wrong here means the wrong colour gets stitched
 * — but refusing to proceed without a choice would put a picker in front of a
 * customer who already made one a screen ago.
 */
function resolveVariant(product: EditorProduct, requested?: string): EditorVariant | null {
  const variants = product.variants ?? [];
  if (!variants.length) return null;
  return (
    (requested ? variants.find((v) => v.id === requested) : undefined) ??
    variants.find((v) => v.isDefault) ??
    variants[0]
  );
}

function variantLabel(variant: EditorVariant): string {
  const fromOptions = (variant.options ?? []).map((o) => o.displayValue ?? o.value).filter(Boolean);
  return fromOptions.length ? fromOptions.join(" / ") : variant.title;
}

async function fetchProduct(slug: string, locale: string): Promise<EditorProduct | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/products/${slug}${langParam(locale)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as EditorProduct;
  } catch {
    return null;
  }
}

async function fetchConfig(productId: string, locale: string, variantId: string): Promise<EditorConfig | null> {
  try {
    // The locale matters here: position names are admin-written localized maps,
    // and without it every shopper sees the English the admin typed first.
    // The variant picks each position's photo for its colour, so a customer
    // embroidering a black cap is never shown a red one.
    const qs = new URLSearchParams({ variant: variantId });
    if (locale !== DEFAULT_LOCALE) qs.set("lang", locale);
    const res = await fetch(`${API_BASE_URL}/shop/personalization/config/${productId}?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as EditorConfig | { available: false };
    return "available" in data ? null : data;
  } catch {
    return null;
  }
}

/**
 * The editor is `noindex`: it is a tool for one product, not a page worth
 * ranking, and seven locales of it would dilute the PDP that should rank
 * instead. It stays a real route rather than a modal so the back button, a
 * shared link and a refresh all behave — most traffic here arrives on a phone
 * from an ad, where a trapped modal is the worst possible failure.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const safeLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const t = getTranslations(safeLocale);
  const product = await fetchProduct(slug, safeLocale);
  return {
    title: product ? `${t.personalize.metaTitle} — ${product.title}` : t.personalize.metaTitle,
    robots: { index: false, follow: true },
  };
}

export default async function PersonalisePage({ params, searchParams }: PageProps) {
  const { slug, locale } = await params;
  if (!isValidLocale(locale)) notFound();

  const [product, { v, line, from, return: ret, edit, qty }] = await Promise.all([fetchProduct(slug, locale), searchParams]);
  if (!product) notFound();

  const variant = resolveVariant(product, v);
  // Nothing to add to a basket without one, and an editor that cannot finish
  // is worse than never offering it.
  if (!variant) notFound();

  const config = await fetchConfig(product.id, locale, variant.id);
  // A product with no template, or a template a shop has since emptied, is not
  // an error — it simply has nothing to personalise, and the PDP is where the
  // customer wanted to be anyway.
  if (!config) notFound();

  // `edit=1`: the line is already embroidered and the editor reopens its design to change it.
  const lineTarget = line ? { itemId: line, mode: edit === "1" ? ("edit" as const) : ("add" as const), ...lineReturn(locale, slug, from, ret) } : undefined;
  const c = getTranslations(locale).personalize;
  const quantity = Math.max(1, Math.floor(Number(qty)) || 1);

  return (
    <PersonalizationEditor
      locale={locale}
      config={config}
      targetLine={lineTarget}
      quantity={quantity}
      tiers={product.upsellingEnabled ? product.upsellTiers?.filter((t) => t.active !== false) : undefined}
      back={lineTarget ? { href: lineTarget.href, label: lineTarget.isCheckout ? c.backToCheckout : from === "cart" ? c.backToCart : c.backToProduct } : undefined}
      product={{
        id: product.id,
        slug: product.slug,
        title: product.title,
        imageUrl: product.featuredImageUrl ?? null,
        basePriceCents: product.basePriceCents,
      }}
      variant={{
        id: variant.id,
        label: variantLabel(variant),
        priceCents: variant.priceCents ?? product.basePriceCents,
      }}
    />
  );
}
