import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import CartHeaderIcon from "./CartHeaderIcon";
import LangSwitcher from "./LangSwitcher";
import ScrollAwareHeader from "./ScrollAwareHeader";
import { BrandLogo, NeutralHomeLink } from "./NeutralChrome";
import ShippingStrip from "./ShippingStrip";
import { NeutralHelpButton, NeutralTrustRow, NeutralTrustTicker } from "./NeutralTrust";
import { getTranslations, type Locale } from "@/lib/i18n";
import { getStoreBrandCopy } from "@/lib/i18n/storeBrand";
import { SITE_NAME } from "@/lib/seo";
import headerStyles from "./CommerceHeader.module.css";
import iconStyles from "./HeaderIconButton.module.css";
import styles from "./NeutralHeader.module.css";

/**
 * The header for products outside the embroidery range (see
 * lib/shop/neutralChrome.ts): the Silomis logo without its "Custom
 * embroidery" tagline, then languages, order tracking and the cart, under
 * the shipping strip (without embroidery production time in its window). No
 * menu, search, wishlist or woven embroidery ground.
 *
 * The space a menu would take holds reassurance instead — secure payment,
 * 14-day returns, a person to ask (a rotating line on phones) — with a Help
 * button by the cart that opens the support chat.
 *
 * For a product sold under a neutral brand, the brand's logo replaces Silomis's.
 */
export default function NeutralHeader({ locale }: { locale: Locale }) {
  const t = getTranslations(locale);

  return (
    <>
      <div className={headerStyles.headerSpacer} aria-hidden="true" />
      <ScrollAwareHeader plain>
        {/* Where the shop ships from and to — trust, not embroidery: kept. */}
        <ShippingStrip locale={locale} generic={t.nav.originStrip} originBased={t.nav.originBased} shipToCountry={t.nav.shipToCountry} withoutProduction />
        <div className={styles.inner}>
          <NeutralHomeLink locale={locale} className={`${headerStyles.logo} ${styles.logoLink}`} ariaLabel={t.nav.logoAriaLabel}>
            {/* Under a neutral brand, its logo instead (lib/shop/storeBrand.ts). */}
            <BrandLogo
              className={styles.brandLogo}
              nameClassName={styles.brandName}
              byline={getStoreBrandCopy(locale).byShop(SITE_NAME)}
              wordmarkClassName={styles.brandWordmark}
              bylineClassName={styles.brandByline}
            >
              <Image src="/assets/logo_silomis_mark.webp" alt="" width={42} height={50} className={headerStyles.logoIcon} />
              <span className={headerStyles.logoText} aria-hidden="true">
                <span className={headerStyles.logoWord}>ilomis</span>
              </span>
            </BrandLogo>
          </NeutralHomeLink>

          <NeutralTrustRow locale={locale} />

          <div className={styles.actions}>
            <NeutralHelpButton locale={locale} />
            <LangSwitcher locale={locale} ariaLabel={t.nav.selectLanguage} />
            <Link href={`/${locale}/shop/orders/track`} className={iconStyles.iconBtn} aria-label={t.nav.trackMyOrder} title={t.nav.trackMyOrder}>
              <Package size={18} strokeWidth={1.75} />
            </Link>
            <CartHeaderIcon label={t.shop.cartNavLabel} />
          </div>
        </div>
        <NeutralTrustTicker locale={locale} />
      </ScrollAwareHeader>
    </>
  );
}
