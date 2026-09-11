import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js and only the
  // node_modules actually reached by the build. The container image drops from
  // a full node:20 + the entire dependency tree to a slim runtime, which is
  // what makes an HPA scale-up useful: a pod that takes 40s to pull and boot
  // is still starting when the traffic spike that triggered it has passed.
  output: "standalone",

  // Inlined into the bundle at build time. `env` always does this — the
  // NEXT_PUBLIC_ prefix has no effect on values declared here — so anything in
  // this object is public by definition. Keep it to values that appear on a
  // page anyway; secrets belong in the server environment only.
  env: {
    API_BASE_URL_BROWSER:  process.env.API_BASE_URL_BROWSER  ?? "http://localhost:4000",

    // Company details printed on the legal notice, privacy policy and cookie
    // policy, in all seven languages. Read through src/lib/legal-entity.ts,
    // which falls back to a visible "[placeholder]" for anything left unset —
    // so a missing value reads as an obvious gap rather than a sentence that
    // quietly lost its subject.
    /** Registered company name, e.g. "Silomis SARL". */
    COMPANY_LEGAL_NAME:           "Silomis",
    /** Legal form, e.g. "SARL", "SAS", "Ltd". */
    COMPANY_LEGAL_FORM:           "SASU",
    /** Full registered address on one line. */
    COMPANY_REGISTERED_ADDRESS:   "17 rue du moulin le châtelet-en-brie 77820",
    /** Commercial register number — SIRET, VAT number, company number. */
    COMPANY_REGISTRATION_NUMBER:  "94195263200011",
    /** Directeur de publication — the person legally responsible for the content. */
    COMPANY_PUBLICATION_DIRECTOR: "Mohamed ben khouya",
    /** Where customers write for support and for data-protection requests. */
    SUPPORT_EMAIL:                "info@silomis.com",
    /** Hosting provider's name and address — a legal notice must disclose it. */
    HOSTING_PROVIDER:             "Hostinger",
    /** Law and courts governing disputes, e.g. "France". */
    LEGAL_JURISDICTION:           "France",
    /** When the policies were last revised, e.g. "September 2026". Printed
     *  verbatim, so write it for your main market's reader. */
    LEGAL_UPDATED_AT:             "September 2026",
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "storage.googleapis.com", port: "", pathname: "/**", search: "" }],
  },
};

export default nextConfig;
