import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./Home.module.css";

/** Title + optional subtitle + optional "view all" link. Shared by every
 *  content section so the page keeps one heading rhythm. */
export default function SectionHead({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string;
  subtitle?: string | null;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className={styles.sectionHead}>
      <div className={styles.sectionHeadText}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {subtitle && <p className={styles.sectionSubtitle}>{subtitle}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className={styles.sectionLink}>
          {linkLabel}
          <ArrowRight size={15} strokeWidth={2.25} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
