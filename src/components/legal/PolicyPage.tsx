import type { PolicyDocument } from "@/lib/i18n/salesPolicies";
import styles from "@/app/[locale]/(storefront)/privacy-policy/privacy.module.css";

/** A numbered policy document — Terms of sale, Returns — in the legal pages' layout. */
export default function PolicyPage({ doc, updated }: { doc: PolicyDocument; updated: string }) {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.updated}>{updated}</p>
        <h1 className={styles.title}>{doc.title}</h1>
        <p className={styles.intro}>{doc.intro}</p>
        {doc.sections.map((sec, i) => (
          <section key={i} className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {i + 1}. {sec.title}
            </h2>
            <p className={styles.sectionBody}>{sec.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
