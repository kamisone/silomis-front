import { Truck, RotateCcw, ShieldCheck, MessagesSquare } from "lucide-react";
import type { getTranslations } from "@/lib/i18n";
import styles from "./Home.module.css";

/**
 * The four objections that stop a first-time buyer — delivery cost, returns,
 * payment safety, and "is anyone actually there". Sits directly under the hero
 * because answering them before the first product is seen is worth more than
 * answering them at checkout.
 */
export default function TrustBar({ t }: { t: ReturnType<typeof getTranslations> }) {
  const items = [
    { Icon: Truck, label: t.shop.homeTrustShipping, sub: t.shop.homeTrustShippingSub },
    { Icon: RotateCcw, label: t.shop.homeTrustReturns, sub: t.shop.homeTrustReturnsSub },
    { Icon: ShieldCheck, label: t.shop.homeTrustSecure, sub: t.shop.homeTrustSecureSub },
    { Icon: MessagesSquare, label: t.shop.homeTrustSupport, sub: t.shop.homeTrustSupportSub },
  ];

  return (
    <section className={styles.trustBar}>
      <div className={styles.container}>
        <ul className={styles.trustGrid}>
          {items.map(({ Icon, label, sub }) => (
            <li key={label} className={styles.trustItem}>
              <span className={styles.trustIcon} aria-hidden="true">
                <Icon size={18} strokeWidth={1.9} />
              </span>
              <span>
                <span className={styles.trustLabel}>{label}</span>
                <span className={styles.trustSub}>{sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
