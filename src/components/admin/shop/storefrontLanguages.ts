import { LOCALES } from "@/lib/i18n";

/** A storefront language, as the admin picks it for photos. */
export type StorefrontLocale = (typeof LOCALES)[number];

/** The storefront's languages in the order the admin lists them. */
export const STOREFRONT_LOCALES: readonly StorefrontLocale[] = LOCALES;

/** How the admin names each storefront language. */
export const LANGUAGE_NAMES: Record<StorefrontLocale, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  de: "German",
  nl: "Dutch",
  pl: "Polish",
  pt: "Portuguese",
};

/** Whether a gallery item (its `locales`) is shown on `locale`'s pages — empty means every language. */
export function shownIn(locales: readonly string[] | null | undefined, locale: StorefrontLocale): boolean {
  return !locales?.length || locales.includes(locale);
}
