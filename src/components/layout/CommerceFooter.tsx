import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./CommerceFooter.module.css";
import CookieSettingsButton from "@/components/consent/CookieSettingsButton";
import { VisaIcon, MastercardIcon, AmexIcon } from "./PaymentIcons";
import { InstagramIcon, FacebookIcon, TiktokIcon } from "./SocialIcons";
import { SOCIAL_LINKS, type SocialKey } from "@/lib/social";
import NewsletterForm from "./NewsletterForm";
import LangSwitcher from "./LangSwitcher";

/** One icon per entry in SOCIAL_LINKS — adding a network there fails the
 *  build here until its icon exists, rather than rendering a blank link. */
const SOCIAL_ICONS: Record<SocialKey, typeof InstagramIcon> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TiktokIcon,
};

export default function CommerceFooter({ locale }: { locale: Locale }) {
  const t = getTranslations(locale);

  // Translated, because the label is what a screen reader announces.
  const SOCIAL_LABELS: Record<SocialKey, string> = {
    instagram: t.footer.socialInstagram,
    facebook: t.footer.socialFacebook,
    tiktok: t.footer.socialTiktok,
  };
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.wave} aria-hidden="true">
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path
            className={styles.wavePath}
            d="M0,58 C220,12 420,92 720,52 C1020,12 1220,88 1440,46 L1440,100 L0,100 Z"
          />
        </svg>
      </div>
      {/* The wave is a real block in the flow, so the dark ground has to start
          below it rather than on <footer> itself — see the module's comment. */}
      <div className={styles.footerBody}>
      <div className={styles.footerInner}>

        <div className={styles.footerGrid}>

          {/* Brand / contact column */}
          <div className={styles.footerCol}>
            <div className={styles.footerLogo}>
              <Image
                src="/assets/logo_silomis_mark.webp"
                alt="Silomis"
                width={27}
                height={32}
                className={styles.logoIcon}
              />
              {/* No S: the mark to its left is the S. The image's alt is
                  already the whole brand name, so this half is hidden —
                  otherwise it reads out as "Silomis ilomis". */}
              <span className={styles.logoText} aria-hidden="true">
                ilomis
              </span>
            </div>
            <p className={styles.footerTagline}>{t.footer.tagline}</p>
            <div className={styles.footerContact}>
              <div className={styles.contactRow}>
                <MapPin className={styles.contactIcon} size={16} aria-hidden="true" />
                <span>{t.footer.addressLine}</span>
              </div>
              <a href={`mailto:${t.footer.emailLabel}`} className={styles.contactRow}>
                <Mail className={styles.contactIcon} size={16} aria-hidden="true" />
                <span>{t.footer.emailLabel}</span>
              </a>
            </div>
            <div className={styles.socialRow}>
              {SOCIAL_LINKS.map(({ key, url }) => {
                const Icon = SOCIAL_ICONS[key];
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    // `noopener` is the one that matters: without it the opened
                    // tab gets a handle on this one through `window.opener`.
                    rel="noopener noreferrer"
                    aria-label={SOCIAL_LABELS[key]}
                    className={styles.socialLink}
                  >
                    <Icon className={styles.socialIcon} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Company column */}
          <div className={styles.footerCol}>
            <h3 className={styles.footerHeading}>{t.footer.companyHeading}</h3>
            <nav className={styles.footerLinks}>
              <Link href={`/${locale}/about`} className={styles.footerLink}>
                {t.footer.about}
              </Link>
              <Link href={`/${locale}/collections`} className={styles.footerLink}>
                {t.footer.shop}
              </Link>
              <Link href={`/${locale}/shop/orders/track`} className={styles.footerLink}>
                {t.nav.trackMyOrder}
              </Link>
              <Link href="/admin" className={styles.footerLink}>
                {t.footer.admin}
              </Link>
            </nav>
          </div>

          {/* Legal column */}
          <div className={styles.footerCol}>
            <h3 className={styles.footerHeading}>{t.footer.legalHeading}</h3>
            <nav className={styles.footerLinks}>
              <Link href={`/${locale}/privacy-policy`} className={styles.footerLink}>
                {t.footer.privacy}
              </Link>
              <Link href={`/${locale}/legal`} className={styles.footerLink}>
                {t.footer.legal}
              </Link>
              <Link href={`/${locale}/cookies`} className={styles.footerLink}>
                {t.footer.cookies}
              </Link>
              <CookieSettingsButton
                label={t.consent.settingsBtn}
                className={styles.footerLink}
              />
            </nav>
          </div>

          {/* Newsletter column */}
          <div className={styles.footerCol}>
            <h3 className={styles.footerHeading}>{t.newsletter.heading}</h3>
            <p className={styles.footerTagline}>{t.newsletter.body}</p>
            <NewsletterForm locale={locale} />
          </div>

        </div>

        {/* ── Bottom row: copyright · language · payment methods ── */}
        <div className={styles.footerBottom}>
          <p className={styles.footerCopy}>
            © {year} Silomis · {t.footer.rights}
          </p>
          <LangSwitcher locale={locale} ariaLabel={t.nav.selectLanguage} />
          <div className={styles.paymentMethods}>
            <span className={styles.paymentLabel}>{t.footer.paymentsAccepted}</span>
            <VisaIcon className={styles.paymentIcon} />
            <MastercardIcon className={styles.paymentIcon} />
            <AmexIcon className={styles.paymentIcon} />
          </div>
        </div>

      </div>
      </div>
    </footer>
  );
}
