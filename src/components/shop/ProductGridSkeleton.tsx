import shopStyles from "@/app/[locale]/(storefront)/shop/Shop.module.css";
import skeleton from "./skeleton.module.css";
import styles from "./ProductGridSkeleton.module.css";

/**
 * Stand-in for the product grid while its data is in flight. Renders into the
 * exact same `.productGrid` class the real grid uses, so the transition from
 * placeholder to real cards is a content swap, not a layout jump.
 *
 * `count` defaults to a typical first page — the number itself doesn't need
 * to match what eventually loads, only enough to fill the viewport plausibly.
 */
export default function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={shopStyles.productGrid} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.card}>
          <div className={`${skeleton.block} ${styles.image}`} />
          <div className={styles.info}>
            <div className={`${skeleton.bar} ${styles.brand}`} />
            <div className={`${skeleton.bar} ${styles.title}`} />
            <div className={`${skeleton.bar} ${styles.titleShort}`} />
            <div className={`${skeleton.bar} ${styles.price}`} />
            <div className={`${skeleton.bar} ${styles.action}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
