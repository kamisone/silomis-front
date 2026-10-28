import { cache } from "react";
import { LEGAL } from "@/lib/legal-entity";
import type { PolicyDocument } from "@/lib/i18n/salesPolicies";
import type { StoreBrandChrome } from "./storeBrand";

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

export interface StoreBrandFaq {
  id: string;
  question: string;
  answer: string;
}

/** A neutral brand's own pages — the backend's StoreBrandPage. */
export interface StoreBrandPage extends StoreBrandChrome {
  aboutTitle: string | null;
  aboutHtml: string | null;
  contactIntro: string | null;
  returnsNote: string | null;
  faqs: StoreBrandFaq[];
  seoTitle: string | null;
  seoDescription: string | null;
  shareImageUrl: string | null;
}

/** One request per render for the layout, its metadata and the page. Null when missing or switched off. */
export const fetchStoreBrandPage = cache(async (slug: string, locale: string): Promise<StoreBrandPage | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/store-brands/${encodeURIComponent(slug)}?lang=${locale}`, { next: { revalidate: 120 } });
    return res.ok ? ((await res.json()) as StoreBrandPage) : null;
  } catch {
    return null;
  }
});

/** The chrome part of the page payload — what the browser keeps (lib/shop/storeBrand.ts). */
export function chromeOf(page: StoreBrandPage): StoreBrandChrome {
  const { id, slug, name, tagline, logoUrl, iconUrl, footerText, supportEmail, supportPhone, hasAbout, hasFaq, homeSlug } = page;
  return { id, slug, name, tagline, logoUrl, iconUrl, footerText, supportEmail, supportPhone, hasAbout, hasFaq, homeSlug };
}

/**
 * The shop's legal copy, said by the brand: "Silomis" the shop becomes the
 * brand's name, in every language at once, and the support address the
 * brand's own when it has one.
 *
 * Silomis the company stays. Its registered name can be "Silomis" too, so it
 * is recognised by how the legal texts always state it — followed by its
 * legal form ("Silomis, SASU, registered at …") — and never rewritten: that
 * is who the seller legally is.
 */
export function rebrand(text: string, brand: Pick<StoreBrandChrome, "name" | "supportEmail">): string {
  const company = `${LEGAL.companyName}, ${LEGAL.legalForm}`;
  const withEmail = brand.supportEmail ? text.split(LEGAL.supportEmail).join(brand.supportEmail) : text;
  return withEmail
    .split(company)
    .map((part) => part.replace(/\bSilomis\b/g, brand.name))
    .join(company);
}

/** rebrand() over a whole policy document. */
export function rebrandDoc(doc: PolicyDocument, brand: Pick<StoreBrandChrome, "name" | "supportEmail">): PolicyDocument {
  return { ...doc, intro: rebrand(doc.intro, brand), sections: doc.sections.map((s) => ({ ...s, title: rebrand(s.title, brand), body: rebrand(s.body, brand) })) };
}
