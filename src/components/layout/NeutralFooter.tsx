import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { getTranslations, type Locale } from "@/lib/i18n";
import { getSalesPolicies } from "@/lib/i18n/salesPolicies";
import CookieSettingsButton from "@/components/consent/CookieSettingsButton";
import { VisaIcon, MastercardIcon, AmexIcon } from "./PaymentIcons";
import LangSwitcher from "./LangSwitcher";
import styles from "./CommerceFooter.module.css";
import neutral from "./NeutralFooter.module.css";

/**
 * The footer for products outside the embroidery range (see
 * lib/shop/neutralChrome.ts): who sells it and how to reach them, order
 * tracking, the legal pages the law requires on a selling page, language and
 * payment methods. No tagline, newsletter, social links or wave.
 */
export default function NeutralFooter({ locale }: { locale: Locale }) {
  const t = getTranslations(locale);
  const policies = getSalesPolicies(locale);
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerBody}>
        <div className={styles.footerInner}>
          <div className={neutral.grid}>
            <div className={styles.footerCol}>
              <div className={styles.footerLogo}>
                <Image src="/assets/logo_silomis_mark.webp" alt="Silomis" width={27} height={32} className={styles.logoIcon} />
                <span className={styles.logoText} aria-hidden="true">
                  ilomis
                </span>
              </div>
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
            </div>

            <nav className={styles.footerLinks} aria-label={t.footer.legalHeading}>
              <Link href={`/${locale}/shop/orders/track`} className={styles.footerLink}>
                {t.nav.trackMyOrder}
              </Link>
              {/* The neutral versions (/info/…): no embroidery copy, neutral header kept. */}
              <Link href={`/${locale}/info/contact`} className={styles.footerLink}>
                {t.nav.contactLabel}
              </Link>
              <Link href={`/${locale}/info/terms`} className={styles.footerLink}>
                {policies.termsLink}
              </Link>
              <Link href={`/${locale}/info/returns`} className={styles.footerLink}>
                {policies.returnsLink}
              </Link>
              <Link href={`/${locale}/privacy-policy`} className={styles.footerLink}>
                {t.footer.privacy}
              </Link>
              <Link href={`/${locale}/legal`} className={styles.footerLink}>
                {t.footer.legal}
              </Link>
              <Link href={`/${locale}/cookies`} className={styles.footerLink}>
                {t.footer.cookies}
              </Link>
              <CookieSettingsButton label={t.consent.settingsBtn} className={styles.footerLink} />
            </nav>
          </div>

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
