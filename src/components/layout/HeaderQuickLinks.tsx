"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shirt } from "lucide-react";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./HeaderQuickLinks.module.css";

interface Props {
  locale: Locale;
}

/** The site-level destinations at the end of the category row, behind a divider
 *  that tells the eye they are a different kind of link from the categories.
 *
 *  Two kinds of thing, deliberately not styled alike:
 *
 *  - "Your own item" is a SERVICE, and the one that sells. It used to sit here
 *    as a quieter relative of the categories, the same weight as Contact — which
 *    made the flagship offer read as a footnote. It is a filled pill now, with an
 *    icon: this is the one place a garment icon earns its keep, because it says
 *    "bring us a thing" in a way the three words do not.
 *  - Contact stays quiet. It is the lowest-intent destination in a shop and it
 *    should not compete with either the categories or the service. */
export default function HeaderQuickLinks({ locale }: Props) {
  const t = getTranslations(locale);
  const pathname = usePathname();

  const sendIn = `/${locale}/embroider-my-item`;
  // No blog link: articles are not browsed as a section any more, they are
  // attached to a product and read from its page.
  const links = [{ href: `/${locale}/contact`, label: t.nav.contactLabel }];
  const isCurrent = (href: string) => pathname === href || !!pathname?.startsWith(`${href}/`);

  return (
    <div className={styles.quickLinks}>
      <Link
        href={sendIn}
        className={`${styles.feature} ${isCurrent(sendIn) ? styles.featureActive : ""}`}
        aria-current={isCurrent(sendIn) ? "page" : undefined}
      >
        <Shirt size={14} strokeWidth={2.25} aria-hidden="true" />
        {t.nav.sendInLabel}
      </Link>

      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`${styles.link} ${isCurrent(link.href) ? styles.linkActive : ""}`}
          aria-current={isCurrent(link.href) ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
