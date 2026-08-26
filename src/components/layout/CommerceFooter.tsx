import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./CommerceFooter.module.css";
import CookieSettingsButton from "@/components/consent/CookieSettingsButton";
import { VisaIcon, MastercardIcon, AmexIcon } from "./PaymentIcons";
import { InstagramIcon, FacebookIcon, TiktokIcon } from "./SocialIcons";
import NewsletterForm from "./NewsletterForm";
import LangSwitcher from "./LangSwitcher";

export default function CommerceFooter({ locale }: { locale: Locale }) {
  const t = getTranslations(locale);
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
                src="/assets/logo_silomis_icon.png"
                alt="Silomis"
                width={28}
                height={21}
                className={styles.logoIcon}
              />
              <span className={styles.logoText}>Silomis</span>
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
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.footer.socialInstagram}
                className={styles.socialLink}
              >
                <InstagramIcon className={styles.socialIcon} />
              </a>
              <a
                href="https://www.facebook.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.footer.socialFacebook}
                className={styles.socialLink}
              >
                <FacebookIcon className={styles.socialIcon} />
              </a>
              <a href="#" aria-label={t.footer.socialTiktok} className={styles.socialLink}>
                <TiktokIcon className={styles.socialIcon} />
              </a>
            </div>
          </div>

          {/* Company column */}
          <div className={styles.footerCol}>
            <h3 className={styles.footerHeading}>{t.footer.companyHeading}</h3>
            <nav className={styles.footerLinks}>
              <Link href={`/${locale}/about`} className={styles.footerLink}>
                {t.footer.about}
              </Link>
              <Link href={`/${locale}/shop`} className={styles.footerLink}>
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
