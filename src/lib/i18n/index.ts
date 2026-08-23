import { en, fr, es, it, de, nl, pl, type Translations } from "./translations";

export const LOCALES = ["en", "fr", "es", "it", "de", "nl", "pl"] as const;
export const DEFAULT_LOCALE = "en" as const;
export type Locale = (typeof LOCALES)[number];

const dict: Record<Locale, Translations> = { en, fr, es, it, de, nl, pl };

export function getTranslations(locale: string): Translations {
  return dict[(locale as Locale) in dict ? (locale as Locale) : DEFAULT_LOCALE];
}

export function isValidLocale(locale: string): locale is Locale {
  return LOCALES.includes(locale as Locale);
}

const BCP47: Record<Locale, string> = {
  en: "en-GB",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
  de: "de-DE",
  nl: "nl-NL",
  pl: "pl-PL",
};

/** BCP-47 tag for Intl/toLocaleDateString APIs (e.g. "fr-FR"). */
export function toBcp47(locale: string): string {
  return BCP47[(locale as Locale) in BCP47 ? (locale as Locale) : DEFAULT_LOCALE];
}
