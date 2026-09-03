import heroStyles from "./CategoryHero.module.css";
import skeleton from "./skeleton.module.css";

/**
 * Stand-in for the breadcrumb + CategoryHero banner while the category list
 * that names them is still loading. Reuses CategoryHero's own `.hero` box
 * (same aspect-ratio, radius, responsive breakpoints) so the page doesn't
 * grow or shrink once the real banner replaces it.
 */
export default function CategoryHeroSkeleton() {
  return (
    <div aria-hidden="true">
      <div className={`${skeleton.bar}`} style={{ height: 13, width: 160, marginBottom: 12, borderRadius: 4 }} />
      <div className={`${heroStyles.hero} ${skeleton.block}`} />
    </div>
  );
}
