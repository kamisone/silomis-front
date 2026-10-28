"use client";

import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { useStoreBrand } from "@/lib/shop/useStoreBrand";
import { getStoreBrandCopy } from "@/lib/i18n/storeBrand";
import styles from "./CommerceFooter.module.css";
import neutral from "./NeutralFooter.module.css";

/**
 * The parts of the neutral footer that change under a neutral brand (see
 * lib/shop/storeBrand.ts). Client components because the brand is only known
 * in the browser; what the server renders is the plain neutral footer, inside
 * `.silomis-mark` so a brand's page hides it from the first paint.
 */

/** The brand's sentence or two under its logo. */
export function BrandFooterText() {
  const brand = useStoreBrand();
  return brand?.footerText ? <p className={neutral.brandText}>{brand.footerText}</p> : null;
}

/** The address customers write to: the brand's own when it has one. */
export function BrandFooterContact({ shopEmail }: { shopEmail: string }) {
  const brand = useStoreBrand();
  const email = brand?.supportEmail || shopEmail;
  const row = (
    <a href={`mailto:${email}`} className={styles.contactRow}>
      <Mail className={styles.contactIcon} size={16} aria-hidden="true" />
      <span>{email}</span>
    </a>
  );
  if (!brand) return <span className="silomis-mark">{row}</span>;
  return (
    <>
      {row}
      {brand.supportPhone && (
        <a href={`tel:${brand.supportPhone.replace(/[^\d+]/g, "")}`} className={styles.contactRow}>
          <Phone className={styles.contactIcon} size={16} aria-hidden="true" />
          <span>{brand.supportPhone}</span>
        </a>
      )}
    </>
  );
}

export interface FooterLinkLabels {
  track: string;
  contact: string;
  terms: string;
  returns: string;
  privacy: string;
  legal: string;
  cookies: string;
}

/**
 * The footer's links: the brand's own pages under /brand/<slug>/ — with About
 * and FAQ when it has them — or the plain neutral pages (/info/…).
 */
export function NeutralFooterLinks({ locale, labels }: { locale: string; labels: FooterLinkLabels }) {
  const brand = useStoreBrand();
  const link = (href: string, label: string) => (
    <Link key={href} href={`/${locale}${href}`} className={styles.footerLink}>
      {label}
    </Link>
  );

  if (!brand) {
    return (
      <span className="silomis-mark">
        {link("/shop/orders/track", labels.track)}
        {link("/info/contact", labels.contact)}
        {link("/info/terms", labels.terms)}
        {link("/info/returns", labels.returns)}
        {link("/privacy-policy", labels.privacy)}
        {link("/legal", labels.legal)}
        {link("/cookies", labels.cookies)}
      </span>
    );
  }

  const copy = getStoreBrandCopy(locale);
  const base = `/brand/${encodeURIComponent(brand.slug)}`;
  return (
    <>
      {brand.hasAbout && link(`${base}/about`, copy.about(brand.name))}
      {brand.hasFaq && link(`${base}/faq`, copy.faq)}
      {link("/shop/orders/track", labels.track)}
      {link(`${base}/contact`, labels.contact)}
      {link(`${base}/terms`, labels.terms)}
      {link(`${base}/returns`, labels.returns)}
      {link(`${base}/privacy`, labels.privacy)}
      {link(`${base}/legal`, labels.legal)}
      {link(`${base}/cookies`, labels.cookies)}
    </>
  );
}
