import styles from "./RelatedSection.module.css";
import skeletonStyles from "./RelatedProductsSkeleton.module.css";

/** Suspense fallback for RelatedSection — mirrors its grid/card shape so the
 * layout doesn't jump once the real recommendations stream in. */
export default function RelatedProductsSkeleton() {
  return (
    <section className={styles.section} aria-hidden="true">
      <div className={`${skeletonStyles.bar} ${skeletonStyles.title}`} />
      <div className={styles.grid}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={skeletonStyles.card}>
            <div className={skeletonStyles.image} />
            <div className={skeletonStyles.info}>
              <div className={`${skeletonStyles.bar} ${skeletonStyles.line}`} />
              <div className={`${skeletonStyles.bar} ${skeletonStyles.lineShort}`} />
              <div className={`${skeletonStyles.bar} ${skeletonStyles.price}`} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
