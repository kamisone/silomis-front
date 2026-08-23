import styles from "./PromotionBadge.module.css";

export type PromotionDiscountType = "percentage" | "fixed_amount" | "free_shipping";

export interface PromotionInfo {
  name: string;
  discountType: PromotionDiscountType;
  discountValue: number;
}

interface Props {
  promotion: PromotionInfo;
  size?: "sm" | "md";
  /** Localized "Free shipping" label — the only free-text string this presentational component needs. */
  freeShippingLabel: string;
}

function formatLabel(p: PromotionInfo, freeShippingLabel: string): string {
  if (p.discountType === "free_shipping") return freeShippingLabel;
  if (p.discountType === "percentage") return `−${p.discountValue}%`;
  return `−€${(p.discountValue / 100).toFixed(2)}`;
}

function TruckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="6" width="14" height="10" rx="1" />
      <path d="M15 10h3.5L22 13v3h-7z" />
      <circle cx="6" cy="18.5" r="1.8" />
      <circle cx="17" cy="18.5" r="1.8" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L3 3v6.59a2 2 0 0 0 .59 1.41l9.59 9.59a2 2 0 0 0 2.82 0l4.59-4.59a2 2 0 0 0 0-2.82Z" />
      <circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function PromotionBadge({ promotion, size = "md", freeShippingLabel }: Props) {
  const sizeClass = styles[size];
  const colorClass = promotion.discountType === "free_shipping" ? styles.blue : styles.green;
  const icon = promotion.discountType === "free_shipping" ? <TruckIcon /> : <TagIcon />;

  return (
    <span className={`${styles.badge} ${sizeClass} ${colorClass}`} title={promotion.name}>
      <em className={styles.icon}>{icon}</em>
      {formatLabel(promotion, freeShippingLabel)}
    </span>
  );
}
