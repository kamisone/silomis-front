import { Truck, RotateCcw, ShieldCheck, MessagesSquare } from "lucide-react";
import { getTrustBadgeIcon } from "@/lib/shop/trustBadgeIcons";
import { localized, type TrustBarItem } from "./sectionTypes";
import type { getTranslations, Locale } from "@/lib/i18n";
import styles from "./Home.module.css";

/**
 * The four objections that stop a first-time buyer — delivery cost, returns,
 * payment safety, and "is anyone actually there". Sits directly under the hero
 * because answering them before the first product is seen is worth more than
 * answering them at checkout.
 *
 * The built-in four are the fallback, not the design: once an admin adds a
 * reassurance of their own they own the whole row, because a mix of translated
 * defaults and hand-written entries reads as an accident.
 */
export default function TrustBar({
  t,
  locale,
  items,
}: {
  t: ReturnType<typeof getTranslations>;
  locale: Locale;
  items?: TrustBarItem[];
}) {
  const authored = (items ?? [])
    .map((item) => ({
      key: item.id,
      Icon: getTrustBadgeIcon(item.icon),
      label: localized(item.label, locale),
      sub: localized(item.sub, locale),
    }))
    // A row with an icon and no words is a blank tile — skip it rather than
    // printing an empty cell.
    .filter((item) => item.label);

  const builtIn = [
    { key: "shipping", Icon: Truck, label: t.shop.homeTrustShipping, sub: t.shop.homeTrustShippingSub },
    { key: "returns", Icon: RotateCcw, label: t.shop.homeTrustReturns, sub: t.shop.homeTrustReturnsSub },
    { key: "secure", Icon: ShieldCheck, label: t.shop.homeTrustSecure, sub: t.shop.homeTrustSecureSub },
    { key: "support", Icon: MessagesSquare, label: t.shop.homeTrustSupport, sub: t.shop.homeTrustSupportSub },
  ];

  const row = authored.length > 0 ? authored : builtIn;

  return (
    <section className={styles.trustBar}>
      <div className={styles.container}>
        <ul className={styles.trustGrid} data-count={row.length}>
          {row.map(({ key, Icon, label, sub }) => (
            <li key={key} className={styles.trustItem}>
              <span className={styles.trustIcon} aria-hidden="true">
                <Icon size={18} strokeWidth={1.9} />
              </span>
              <span>
                <span className={styles.trustLabel}>{label}</span>
                {sub && <span className={styles.trustSub}>{sub}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
