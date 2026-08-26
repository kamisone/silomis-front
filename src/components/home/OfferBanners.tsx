import Link from "next/link";
import type { getTranslations, Locale } from "@/lib/i18n";
import { localized, OFFER_SLOTS, type OfferBanner } from "./sectionTypes";
import SectionHead from "./SectionHead";
import styles from "./Home.module.css";

/** What the storefront needs to turn a picked `collectionId` into a link. */
export interface OfferBannerTarget {
  id: string;
  slug: string;
  name: string;
}

/**
 * Which cell each picture is placed in, by its position in the config.
 *
 * Placement is by index rather than by document order, so a picture the admin
 * has not supplied yet leaves its own cell empty instead of pulling the next
 * one into a slot it was never meant for.
 */
const SLOT_CLASS: Record<(typeof OFFER_SLOTS)[number], string> = {
  tall: styles.offerCellTall,
  topRight: styles.offerCellTopRight,
  midRight: styles.offerCellMidRight,
  bottomLeft: styles.offerCellBottomLeft,
  bottomRight: styles.offerCellBottomRight,
};

/**
 * The "En ce moment" grid: hand-made pictures, each opening a collection.
 *
 * Unlike every other list section this one has no catalogue query behind it —
 * the admin uploads the artwork and picks where each piece goes. So an empty
 * one renders nothing at all rather than a heading over a gap.
 *
 * Two columns by three rows, five pictures: one standing tall down the left
 * across rows 1 and 2, two short ones stacked beside it, and two more along the
 * bottom. See OFFER_SLOTS for the map.
 */
export default function OfferBanners({
  banners,
  targets,
  locale,
  t,
  title,
  subtitle,
  tinted = false,
}: {
  /** In slot order. A gap in the list is a gap in the grid. */
  banners: OfferBanner[];
  /** The collections the banners can point at, by id. */
  targets: Map<string, OfferBannerTarget>;
  locale: Locale;
  t: ReturnType<typeof getTranslations>;
  title?: string;
  subtitle?: string;
  tinted?: boolean;
}) {
  // A banner is its picture — one without an image has nothing to render, and
  // its cell simply stays empty.
  const placed = OFFER_SLOTS.map((slot, i) => ({ slot, banner: banners[i] })).filter(({ banner }) => banner?.imageUrl);
  if (placed.length === 0) return null;

  return (
    <section className={`${styles.section} ${tinted ? styles.sectionTinted : ""}`}>
      <div className={styles.container}>
        <SectionHead title={title || t.shop.homeOffersTitle} subtitle={subtitle} />

        <div className={styles.offerGrid}>
          {placed.map(({ slot, banner }) => {
            const target = banner.collectionId ? targets.get(banner.collectionId) : undefined;
            const cta = localized(banner.ctaLabel, locale) || t.shop.homeOffersCta;
            // The picture carries the offer, so it needs describing — the
            // collection's own name is the closest thing to that wording the
            // admin has already written.
            const alt = target?.name ?? "";
            const className = `${styles.offerTile} ${SLOT_CLASS[slot]}`;

            const body = (
              <>
                {/* The rounding and cropping live on an inner frame, because the
                    tile itself must not clip — the button hangs off its bottom. */}
                <span className={styles.offerFrame}>
                  <picture>
                    {banner.mobileImageUrl && <source media="(max-width: 640px)" srcSet={banner.mobileImageUrl} />}
                    {/* The tall one is usually the largest thing below the hero,
                        so it is worth fetching eagerly; the rest can wait. */}
                    <img
                      src={banner.imageUrl ?? undefined}
                      alt={alt}
                      className={styles.offerImage}
                      loading={slot === "tall" ? "eager" : "lazy"}
                    />
                  </picture>
                </span>
                {target && <span className={styles.offerCta}>{cta}</span>}
              </>
            );

            // A collection that was deleted or switched off leaves the artwork
            // in place, just without a destination — which beats both a hole in
            // the grid and a button that goes nowhere.
            return target ? (
              <Link key={banner.id} href={`/${locale}/collections/${target.slug}`} className={className}>
                {body}
              </Link>
            ) : (
              <div key={banner.id} className={className}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
