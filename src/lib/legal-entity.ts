/**
 * The company details every legal page states.
 *
 * These were literal placeholders — "[Company legal name]", "[Registered
 * address]" — written into all seven translation dictionaries, so filling them
 * in meant editing 60-odd strings and getting every locale right. One source
 * here, read from the build environment.
 *
 * The values come through `env` in next.config.ts, which inlines them at build
 * time on both the server and the client (a legal page renders in both). Each
 * falls back to its original bracketed placeholder rather than an empty
 * string: an unset value then shows up as an obvious gap to fill instead of a
 * sentence that silently reads "registered at ." and looks finished.
 *
 * Set them in the environment; do not hard-code them here.
 */
function value(raw: string | undefined, placeholder: string): string {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : `[${placeholder}]`;
}

export const LEGAL = {
  /** Registered company name, e.g. "Silomis SARL". */
  companyName: value(process.env.COMPANY_LEGAL_NAME, "Company legal name"),
  /** Legal form, e.g. "SARL", "SAS", "Ltd". */
  legalForm: value(process.env.COMPANY_LEGAL_FORM, "legal form"),
  /** Full registered address, on one line. */
  registeredAddress: value(process.env.COMPANY_REGISTERED_ADDRESS, "Registered address"),
  /** Company/commercial register number, e.g. a SIRET or VAT number. */
  registrationNumber: value(process.env.COMPANY_REGISTRATION_NUMBER, "Registration number"),
  /** Person legally responsible for what is published — the directeur de publication. */
  publicationDirector: value(process.env.COMPANY_PUBLICATION_DIRECTOR, "Name"),
  /** Address customers are told to write to for support and data requests. */
  supportEmail: value(process.env.SUPPORT_EMAIL, "support email"),
  /** Hosting provider's name and address, which a legal notice must disclose. */
  hostingProvider: value(process.env.HOSTING_PROVIDER, "Hosting provider name and address"),
  /** Courts and law that govern disputes, e.g. "France". */
  jurisdiction: value(process.env.LEGAL_JURISDICTION, "Jurisdiction"),
  /** When the policies were last revised, e.g. "September 2026". Shown as-is,
   *  so write it in a form that reads correctly for your main market. */
  updatedAt: value(process.env.LEGAL_UPDATED_AT, "Month Year"),
} as const;
