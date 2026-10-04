import { LEGAL } from "@/lib/legal-entity";

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

interface PublicCountry {
  isoCode: string;
  isEuVat?: boolean;
  isShippingEnabled?: boolean;
}

/**
 * The EU countries the shop ships to, as ISO codes — for structured data.
 *
 * Read from the same country list checkout offers (active, shipping-enabled,
 * EU), so what Google is told matches what a customer can actually order.
 * Falls back to France alone rather than to nothing if the API is down: the
 * shop is French, that much is always true.
 */
export async function fetchEuShippingCountries(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/countries`, { next: { revalidate: 3600 } });
    if (!res.ok) return ["FR"];
    const data = (await res.json()) as PublicCountry[];
    const codes = (Array.isArray(data) ? data : []).filter((c) => c.isEuVat && c.isShippingEnabled).map((c) => c.isoCode);
    return codes.length ? codes : ["FR"];
  } catch {
    return ["FR"];
  }
}

/** schema.org regions for a list of ISO country codes. */
export function definedRegions(codes: string[]) {
  return codes.map((code) => ({ "@type": "DefinedRegion", addressCountry: code }));
}

/**
 * The company's postal address. The registered address is stored as one line
 * (next.config.ts), so it goes in as the street line with the country beside
 * it — splitting it into locality/postcode here would be guessing.
 */
export const ORGANIZATION_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: LEGAL.registeredAddress,
  addressCountry: "FR",
} as const;
