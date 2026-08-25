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
              <Image src="/assets/logo_silomis_icon.png" alt="" width={43} height={32} className={styles.logoIcon} priority />
              <Image src="/assets/logo_silomis_text.png" alt="" width={84} height={32} className={styles.logoText} priority />
            </Link>

            <HeaderQuickLinks locale={locale} />

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

          {/* ── Row 2: category/discovery navigation ── */}
          <nav className={styles.menuRow} aria-label={t.nav.navAriaLabel}>
            <CommerceCategoryNav locale={locale} className={styles.menuItem} />
          </nav>
        </div>
      </ScrollAwareHeader>
    </>
  );
}
