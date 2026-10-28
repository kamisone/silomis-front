import Image from "next/image";
import { MapPin } from "lucide-react";
import { getTranslations, type Locale } from "@/lib/i18n";
import { getSalesPolicies } from "@/lib/i18n/salesPolicies";
import CookieSettingsButton from "@/components/consent/CookieSettingsButton";
import { VisaIcon, MastercardIcon, AmexIcon } from "./PaymentIcons";
import LangSwitcher from "./LangSwitcher";
import { BrandLogo, BrandName } from "./NeutralChrome";
import { BrandFooterContact, BrandFooterText, NeutralFooterLinks } from "./NeutralFooterBrand";
import styles from "./CommerceFooter.module.css";
import neutral from "./NeutralFooter.module.css";

/**
 * The footer for products outside the embroidery range (see
 * lib/shop/neutralChrome.ts): who sells it and how to reach them, order
 * tracking, the legal pages the law requires on a selling page, language and
 * payment methods. No tagline, newsletter, social links or wave.
 *
 * Under a neutral brand: its logo, text, contact and pages instead (see
 * NeutralFooterBrand). The address stays — it is the seller's.
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
                <BrandLogo className={neutral.brandLogo} nameClassName={neutral.brandName}>
                  <Image src="/assets/logo_silomis_mark.webp" alt="Silomis" width={27} height={32} className={styles.logoIcon} />
                  <span className={styles.logoText} aria-hidden="true">
                    ilomis
                  </span>
                </BrandLogo>
              </div>
              <BrandFooterText />
              <div className={styles.footerContact}>
                {/* The company's address: the seller's, whatever the brand. */}
                <div className={styles.contactRow}>
                  <MapPin className={styles.contactIcon} size={16} aria-hidden="true" />
                  <span>{t.footer.addressLine}</span>
                </div>
                <BrandFooterContact shopEmail={t.footer.emailLabel} />
              </div>
            </div>

            <nav className={styles.footerLinks} aria-label={t.footer.legalHeading}>
              {/* The neutral versions (/info/…, or the brand's own /brand/<slug>/…): no embroidery copy, neutral header kept. */}
              <NeutralFooterLinks
                locale={locale}
                labels={{
                  track: t.nav.trackMyOrder,
                  contact: t.nav.contactLabel,
                  terms: policies.termsLink,
                  returns: policies.returnsLink,
                  privacy: t.footer.privacy,
                  legal: t.footer.legal,
                  cookies: t.footer.cookies,
                }}
              />
              <CookieSettingsButton label={t.consent.settingsBtn} className={styles.footerLink} />
            </nav>
          </div>

          <div className={styles.footerBottom}>
            <p className={styles.footerCopy}>
              © {year} <BrandName /> · {t.footer.rights}
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
