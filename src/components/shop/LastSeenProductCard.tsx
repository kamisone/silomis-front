"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, X } from "lucide-react";
import { useCookieConsent } from "@/components/consent/CookieConsentContext";
import { getTranslations, type Locale } from "@/lib/i18n";
import { centsToAmount } from "./ProductCard";
import { dismissLastSeen, readLastSeen, LAST_SEEN_EVENT, LAST_SEEN_KEY, type LastSeenProduct } from "@/lib/lastSeenProduct";
import styles from "./LastSeenProductCard.module.css";

/** Where a floating card is more nuisance than help: nothing should compete
 *  with a shopper who is paying. */
const MUTED_PATHS = ["/shop/checkout"];

/**
 * A small floating card offering the way back to the product the shopper was
 * just looking at.
 *
 * Rendered once by the storefront layout rather than per page, so it survives
 * client-side navigation instead of animating in again on every route change.
 * It stays out of the way in four cases: nothing viewed yet, the shopper closed
 * it, they are already on that product's page, or they are in checkout.
 */
export default function LastSeenProductCard({ locale }: { locale: Locale }) {
  const t = getTranslations(locale);
  const pathname = usePathname();
  // The cookie banner is a full-width bar along the bottom of the page, so
  // until it has been answered there is nowhere for this to sit that would not
  // be either covered by it or stacked awkwardly above it.
  const { consent } = useCookieConsent();

  const [product, setProduct] = useState<LastSeenProduct | null>(null);
  // Both are keyed by the product's href rather than being plain booleans, so a
  // newly viewed product resets them without an effect that has to notice the
  // change and undo itself.
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [closingFor, setClosingFor] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setProduct(readLastSeen());
    sync();

    window.addEventListener(LAST_SEEN_EVENT, sync);
    // Cross-tab: closing the card in one tab should close it in the others.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === LAST_SEEN_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LAST_SEEN_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);

  const href = product ? `/${locale}/shop/${product.slug}` : "";
  const eligible =
    !!product &&
    !product.dismissed &&
    !!consent &&
    // Already there — the card would be an invitation to where the shopper is
    // standing. Compared against the full path rather than a `/shop/` prefix,
    // because cart, checkout, search and wishlist live under /shop too.
    pathname !== href &&
    !MUTED_PATHS.some((p) => pathname.startsWith(`/${locale}${p}`));

  useEffect(() => {
    if (!eligible) return;
    // A beat before it slides in, so it reads as an offer rather than as
    // something that fell onto the page during load.
    const timer = setTimeout(() => setRevealedFor(href), 400);
    return () => clearTimeout(timer);
  }, [eligible, href]);

  if (!eligible || !product) return null;

  const shown = revealedFor === href && closingFor !== href;

  /** Fades out first, then records the dismissal — writing straight away would
   *  unmount the card mid-transition and make it disappear rather than close. */
  function close() {
    setClosingFor(href);
    setTimeout(dismissLastSeen, 240);
  }

  return (
    <aside className={`${styles.card} ${shown ? styles.cardShown : ""}`} aria-label={t.shop.lastSeenTitle}>
      <Link href={href} className={styles.link}>
        <span className={styles.media}>
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className={styles.image} loading="lazy" />
          ) : (
            <span className={styles.imageFallback} aria-hidden="true" />
          )}
        </span>

        <span className={styles.body}>
          <span className={styles.eyebrow}>
            <History size={12} strokeWidth={2.4} aria-hidden="true" />
            {t.shop.lastSeenTitle}
          </span>
          <span className={styles.title}>{product.title}</span>
          {product.priceCents != null && <span className={styles.price}>{centsToAmount(product.priceCents)}</span>}
        </span>
      </Link>

      <button
        type="button"
        className={styles.close}
        onClick={close}
        aria-label={t.shop.lastSeenDismiss}
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </aside>
  );
}
