import styles from "./RelatedProductsCarousel.module.css";
import skeletonStyles from "./RelatedProductsSkeleton.module.css";

/** Suspense fallback for RelatedSection — mirrors the carousel's track/card
 * shape so the layout doesn't jump once the real recommendations stream in. */
export default function RelatedProductsSkeleton() {
  return (
    <section className={styles.section} aria-hidden="true">
      <div className={`${skeletonStyles.bar} ${skeletonStyles.title}`} />
      <div className={styles.viewport}>
        <div className={styles.track}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={styles.slide}>
              <div className={skeletonStyles.card}>
                <div className={skeletonStyles.image} />
                <div className={skeletonStyles.info}>
                  <div className={`${skeletonStyles.bar} ${skeletonStyles.line}`} />
                  <div className={`${skeletonStyles.bar} ${skeletonStyles.lineShort}`} />
                  <div className={`${skeletonStyles.bar} ${skeletonStyles.price}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
