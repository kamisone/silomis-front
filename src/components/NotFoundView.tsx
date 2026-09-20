import Link from "next/link";
import { ArrowRight, LayoutGrid, MessageCircle, Percent, Shirt, Sparkles, Truck, type LucideIcon } from "lucide-react";
import SearchAutocomplete from "./shop/SearchAutocomplete";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./NotFoundView.module.css";

/**
 * The shared body of every 404 on the site.
 *
 * It is rendered from two boundaries — the storefront one (which sits inside
 * the commerce layout and so already has the header, footer and cart around
 * it) and the root one (which does not, and supplies its own brand bar). The
 * page itself is identical in both, which is the point: a visitor who mistypes
 * a URL should not be able to tell which of the two caught them.
 *
 * Deliberately free of data fetching. A 404 is the one page that has to render
 * when something else has already gone wrong, so the only network call on it
 * is the search box the visitor chooses to use.
 */

interface Destination {
  key: string;
  href: string;
  Icon: LucideIcon;
  label: string;
  hint: string;
}

export default function NotFoundView({ locale }: { locale: Locale }) {
  const t = getTranslations(locale);
  const nf = t.notFound;

  // Labels are pulled from the namespaces that already own them — the nav and
  // the shop — so a rename there follows through to here instead of leaving
  // the 404 as the one page still calling it something else.
  const destinations: Destination[] = [
    { key: "new", href: `/${locale}/new`, Icon: Sparkles, label: t.shop.newBreadcrumb, hint: nf.hints.newArrivals },
    { key: "sale", href: `/${locale}/sale`, Icon: Percent, label: t.shop.saleTitle, hint: nf.hints.sale },
    { key: "collections", href: `/${locale}/collections`, Icon: LayoutGrid, label: t.shop.collectionsTitle, hint: nf.hints.collections },
    { key: "embroidery", href: `/${locale}/embroider-my-item`, Icon: Shirt, label: t.nav.sendInLabel, hint: nf.hints.embroidery },
    { key: "track", href: `/${locale}/shop/orders/track`, Icon: Truck, label: t.nav.trackMyOrder, hint: nf.hints.track },
    { key: "contact", href: `/${locale}/contact`, Icon: MessageCircle, label: t.nav.contactLabel, hint: nf.hints.contact },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true">
        <span className={styles.glowTeal} />
        <span className={styles.glowPink} />
        <span className={styles.weave} />
      </div>

      <div className={styles.inner}>
        <p className={styles.eyebrow}>{nf.eyebrow}</p>

        {/* The zero is an embroidery hoop. It is the one piece of brand on the
            page that cannot be mistaken for a generic error template, and it
            costs nothing — the ring, the bracket and the running stitch are
            three shapes. Sized in em so it scales with the digits beside it. */}
        {/* Decorative: the eyebrow above already announces "Error 404", so
            labelling this as an image would make a screen reader say it twice. */}
        <p className={styles.numeral} aria-hidden="true">
          <span className={styles.digit}>4</span>
          <svg className={styles.hoop} viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <rect x="42" y="1.5" width="16" height="13" rx="3.5" fill="var(--color-primary)" />
            <circle cx="50" cy="8" r="2.6" fill="var(--background)" />
            <circle cx="50" cy="54" r="40" stroke="var(--color-primary)" strokeWidth="7" />
            <circle
              cx="50"
              cy="54"
              r="30"
              stroke="var(--color-accent)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="8 8"
            />
          </svg>
          <span className={styles.digit}>4</span>
        </p>

        <h1 className={styles.title}>{nf.title}</h1>
        <p className={styles.body}>{nf.body}</p>

        <div className={styles.searchWrap}>
          <span className={styles.searchLabel}>{nf.searchLabel}</span>
          <SearchAutocomplete locale={locale} />
        </div>

        <div className={styles.actions}>
          <Link href={`/${locale}`} className={styles.primaryBtn}>
            {nf.primaryCta}
            <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" />
          </Link>
          <Link href={`/${locale}/collections`} className={styles.ghostBtn}>
            {nf.secondaryCta}
          </Link>
        </div>

        <section className={styles.links} aria-labelledby="not-found-links">
          <h2 id="not-found-links" className={styles.linksTitle}>
            {nf.linksTitle}
          </h2>
          <ul className={styles.linkGrid}>
            {destinations.map(({ key, href, Icon, label, hint }) => (
              <li key={key}>
                <Link href={href} className={styles.linkCard}>
                  <span className={styles.linkIcon} aria-hidden="true">
                    <Icon size={18} strokeWidth={1.9} />
                  </span>
                  <span className={styles.linkText}>
                    <span className={styles.linkLabel}>{label}</span>
                    <span className={styles.linkHint}>{hint}</span>
                  </span>
                  <ArrowRight className={styles.linkArrow} size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
