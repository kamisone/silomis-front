"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, Mail, type LucideIcon } from "lucide-react";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./HeaderQuickLinks.module.css";

interface Props {
  locale: Locale;
}

/** "Blog" / "Contact" — static site-section links, kept next to the logo on
 *  every breakpoint. Desktop shows the icon-free full uppercase label inline;
 *  narrow screens don't have room for that next to the logo, search and cart,
 *  so each link becomes a compact tab-style badge — its icon (Newspaper /
 *  Mail) on top with the full word as a small caption underneath, the same
 *  icon+label pairing mobile tab bars use so the meaning stays unambiguous
 *  even at a glance. */
export default function HeaderQuickLinks({ locale }: Props) {
  const t = getTranslations(locale);
  const pathname = usePathname();

  const links: { href: string; label: string; icon: LucideIcon }[] = [
    { href: `/${locale}/blog`, label: t.nav.blogLabel, icon: Newspaper },
    { href: `/${locale}/contact`, label: t.nav.contactLabel, icon: Mail },
  ];

  return (
    <div className={styles.quickLinks}>
      {links.map((link) => {
        const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.link} ${active ? styles.linkActive : ""}`}
            aria-label={link.label}
            title={link.label}
          >
            <Icon size={15} strokeWidth={2.25} className={styles.linkIcon} aria-hidden="true" />
            <span className={styles.linkLabel}>{link.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
