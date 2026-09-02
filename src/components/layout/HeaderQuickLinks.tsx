"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./HeaderQuickLinks.module.css";

interface Props {
  locale: Locale;
}

/** "Contact" — the site's non-shopping section, sitting at the end of the
 *  category row behind a divider. A list, not a single link, because this is
 *  where any further site-level page belongs.
 *
 *  They are styled as a quieter relative of the category links rather than as
 *  their equals: same family, lower contrast, so the row still reads
 *  categories-first and these do not compete with them. No icons — an icon
 *  earns its place when it replaces a word, and here there is room for the
 *  word at every width, because this row already scrolls. */
export default function HeaderQuickLinks({ locale }: Props) {
  const t = getTranslations(locale);
  const pathname = usePathname();

  // No blog link: articles are not browsed as a section any more, they are
  // attached to a product and read from its page.
  const links = [{ href: `/${locale}/contact`, label: t.nav.contactLabel }];

  return (
    <div className={styles.quickLinks}>
      {links.map((link) => {
        const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.link} ${active ? styles.linkActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
