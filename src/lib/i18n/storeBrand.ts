import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/**
 * Copy for the pages of a neutral brand (a product sold under its own name
 * instead of Silomis — see lib/shop/storeBrand.ts) that the brand's admin
 * does not write: link labels, the FAQ heading, the line that names the
 * company behind the brand.
 */
export interface StoreBrandCopy {
  about: (brand: string) => string;
  faq: string;
  faqTitle: string;
  /** Heading over the brand's own return conditions, above the shop's policy. */
  productReturns: string;
  /** Under the brand on its legal pages: the company that actually sells. */
  operatedBy: (brand: string, company: string) => string;
  /** The signature under a brand's name in the neutral header, e.g. "by Silomis". */
  byShop: (shop: string) => string;
}

const dict: Record<Locale, StoreBrandCopy> = {
  en: {
    about: (b) => `About ${b}`,
    faq: "FAQ",
    faqTitle: "Frequently asked questions",
    productReturns: "About this product",
    operatedBy: (b, c) => `${b} is a brand operated by ${c}.`,
    byShop: (s) => `by ${s}`,
  },
  fr: {
    about: (b) => `À propos de ${b}`,
    faq: "FAQ",
    faqTitle: "Questions fréquentes",
    productReturns: "À propos de ce produit",
    operatedBy: (b, c) => `${b} est une marque exploitée par ${c}.`,
    byShop: (s) => `par ${s}`,
  },
  es: {
    about: (b) => `Sobre ${b}`,
    faq: "Preguntas frecuentes",
    faqTitle: "Preguntas frecuentes",
    productReturns: "Sobre este producto",
    operatedBy: (b, c) => `${b} es una marca gestionada por ${c}.`,
    byShop: (s) => `por ${s}`,
  },
  it: {
    about: (b) => `Chi è ${b}`,
    faq: "FAQ",
    faqTitle: "Domande frequenti",
    productReturns: "Su questo prodotto",
    operatedBy: (b, c) => `${b} è un marchio gestito da ${c}.`,
    byShop: (s) => `di ${s}`,
  },
  de: {
    about: (b) => `Über ${b}`,
    faq: "FAQ",
    faqTitle: "Häufige Fragen",
    productReturns: "Zu diesem Produkt",
    operatedBy: (b, c) => `${b} ist eine Marke von ${c}.`,
    byShop: (s) => `von ${s}`,
  },
  nl: {
    about: (b) => `Over ${b}`,
    faq: "FAQ",
    faqTitle: "Veelgestelde vragen",
    productReturns: "Over dit product",
    operatedBy: (b, c) => `${b} is een merk van ${c}.`,
    byShop: (s) => `door ${s}`,
  },
  pl: {
    about: (b) => `O ${b}`,
    faq: "FAQ",
    faqTitle: "Najczęstsze pytania",
    productReturns: "O tym produkcie",
    operatedBy: (b, c) => `${b} to marka prowadzona przez ${c}.`,
    byShop: (s) => `od ${s}`,
  },
  pt: {
    about: (b) => `Sobre a ${b}`,
    faq: "Perguntas frequentes",
    faqTitle: "Perguntas frequentes",
    productReturns: "Sobre este produto",
    operatedBy: (b, c) => `${b} é uma marca gerida por ${c}.`,
    byShop: (s) => `por ${s}`,
  },
};

export function getStoreBrandCopy(locale: string): StoreBrandCopy {
  return dict[(locale as Locale) in dict ? (locale as Locale) : DEFAULT_LOCALE];
}
