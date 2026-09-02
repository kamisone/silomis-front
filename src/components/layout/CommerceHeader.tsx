import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import CartHeaderIcon from "./CartHeaderIcon";
import WishlistHeaderIcon from "./WishlistHeaderIcon";
import LangSwitcher from "./LangSwitcher";
import ScrollAwareHeader from "./ScrollAwareHeader";
import SearchAutocomplete from "../shop/SearchAutocomplete";
import CommerceCategoryNav from "../shop/CommerceCategoryNav";
import HeaderQuickLinks from "./HeaderQuickLinks";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./CommerceHeader.module.css";
import iconStyles from "./HeaderIconButton.module.css";

export default function CommerceHeader({ locale }: { locale: Locale }) {
  const t = getTranslations(locale);
  const shop = t.shop;

  return (
    <>
      <div className={styles.headerSpacer} aria-hidden="true" />
      <ScrollAwareHeader>
        <div className={styles.inner}>
          {/* ── Row 1: logo, search, account/wishlist/cart ── */}
          <div className={styles.topRow}>
            <Link href={`/${locale}`} className={`${styles.logo} ${styles.logoOrder}`} aria-label={t.nav.logoAriaLabel}>
              {/* The wordmark is set in type rather than shipped as a bitmap: it
                  stays crisp at any density, recolours with the theme, is
                  translatable, and drops a render-blocking request from the
                  header. Only the mark itself is still an image. */}
              <Image src="/assets/logo_silomis_icon.png" alt="" width={40} height={42} className={styles.logoIcon} priority />
              {/* No S: the mark to its left is the S. aria-hidden because the
                  link already carries the real name — without it a screen
                  reader would announce the brand as "ilomis". */}
              <span className={styles.logoWord} aria-hidden="true">
                ilomis
              </span>
            </Link>

            <div className={styles.searchDesktop}>
              <SearchAutocomplete locale={locale} />
            </div>

            <div className={`${styles.navRight} ${styles.iconsOrder}`}>
              <LangSwitcher locale={locale} ariaLabel={t.nav.selectLanguage} />
              <Link href={`/${locale}/shop/orders/track`} className={iconStyles.iconBtn} aria-label={t.nav.trackMyOrder} title={t.nav.trackMyOrder}>
                <Package size={18} strokeWidth={1.75} />
              </Link>
              <WishlistHeaderIcon locale={locale} label={shop.wishlistNavLabel} />
              <CartHeaderIcon label={shop.cartNavLabel} />
            </div>

            <div className={styles.searchMobile}>
              <SearchAutocomplete locale={locale} />
            </div>
          </div>

          {/* ── Row 2: category/discovery navigation ──
              Blog and Contact live at the end of this row rather than up beside
              the logo. They are the two lowest-intent destinations in a shop,
              and in row 1 they were sitting in the most valuable space on the
              page — between the wordmark and the search field — pushing the
              one control shoppers actually use into whatever was left. */}
          <nav className={styles.menuRow} aria-label={t.nav.navAriaLabel}>
            <CommerceCategoryNav locale={locale} className={styles.menuItem} />
            <HeaderQuickLinks locale={locale} />
          </nav>
        </div>
      </ScrollAwareHeader>
    </>
  );
}
