"use client";

import { RotateCcw } from "lucide-react";
import styles from "./ReturnsGuarantee.module.css";

/**
 * "14-day returns, no questions asked" reassurance panel — sits right after
 * the FAQ section. The CTA scrolls back up to the add-to-cart/buy-now row
 * (#product-actions, see ShopProductDetail.tsx) rather than linking there,
 * since this section can render far down a long product page.
 */
export default function ReturnsGuarantee({ title, body, buttonLabel, ariaLabel }: { title: string; body: string; buttonLabel: string; ariaLabel: string }) {
  const handleClick = () => {
    const target = document.getElementById("product-actions");
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <section className={styles.section} aria-label={ariaLabel}>
      <span className={styles.shapeA} aria-hidden="true" />
      <span className={styles.shapeB} aria-hidden="true" />

      <div className={styles.inner}>
        <span className={styles.icon} aria-hidden="true">
          <RotateCcw size={24} strokeWidth={2.25} />
        </span>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.body}>{body}</p>
        <button type="button" className={styles.button} onClick={handleClick}>
          {buttonLabel}
        </button>
      </div>
    </section>
  );
}
