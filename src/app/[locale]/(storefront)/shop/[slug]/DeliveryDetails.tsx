"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { getTranslations } from "@/lib/i18n";
import styles from "./ProductDetail.module.css";

interface OverviewMethod {
  id: string;
  name: string;
  carrier: string | null;
  priceCents: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

interface OverviewZone {
  id: string;
  name: string;
  countryCodes: string[];
  methods: OverviewMethod[];
}

interface CountryOption {
  isoCode: string;
  name: string;
}

function centsToEuros(cents: number) {
  return (cents / 100).toFixed(2);
}

/** Keeps a zone's country list scannable — a full EU roster would otherwise wrap for lines. */
function formatCountryNames(codes: string[], countryMap: Map<string, string>, worldwideLabel: string): string {
  if (!codes.length) return worldwideLabel;
  const names = codes.map((code) => countryMap.get(code) ?? code);
  const MAX = 6;
  if (names.length <= MAX) return names.join(", ");
  return `${names.slice(0, MAX).join(", ")} +${names.length - MAX}`;
}

function formatDays(min: number, max: number, unit: string): string {
  return min === max ? `${min} ${unit}` : `${min}–${max} ${unit}`;
}

interface Props {
  locale: string;
  freeShipping?: boolean;
}

export default function DeliveryDetails({ locale, freeShipping }: Props) {
  const t = getTranslations(locale).shop;
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [zones, setZones] = useState<OverviewZone[]>([]);
  const [countryMap, setCountryMap] = useState<Map<string, string>>(new Map());

  async function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!e.currentTarget.open || loaded || loading) return;
    setLoading(true);
    setError(false);
    try {
      const qs = locale !== "en" ? `?lang=${locale}` : "";
      const [overviewRes, countriesRes] = await Promise.all([
        fetch(`/next-api/public/shop/shipping/overview${qs}`),
        fetch(`/next-api/public/shop/countries${qs}`),
      ]);
      if (!overviewRes.ok || !countriesRes.ok) throw new Error("delivery details fetch failed");
      const overviewData: Array<{ zone: OverviewZone; methods: OverviewMethod[] }> = await overviewRes.json();
      const countriesData: CountryOption[] = await countriesRes.json();
      setZones(overviewData.map((row) => ({ ...row.zone, methods: row.methods })));
      setCountryMap(new Map(countriesData.map((c) => [c.isoCode, c.name])));
      setLoaded(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // Free delivery has nothing to compare: a plain card that says so, not a
  // dropdown that opens onto the paid zone-by-zone rates the customer will
  // never be charged. The delivery time is already in the banner under the price.
  if (freeShipping) {
    return (
      <div className={`${styles.deliverySection} ${styles.deliveryStatic}`}>
        <div className={styles.deliveryToggle}>
          <span className={styles.deliveryToggleLabel}>
            <Truck size={16} className={styles.deliveryToggleIcon} aria-hidden="true" />
            {t.deliveryDetailsTitle}
          </span>
          <span className={styles.deliveryFreePill}>{t.deliveryDetailsFree}</span>
        </div>
      </div>
    );
  }

  return (
    <details className={styles.deliverySection} onToggle={handleToggle}>
      <summary className={styles.deliveryToggle}>
        <span className={styles.deliveryToggleLabel}>
          <Truck size={16} className={styles.deliveryToggleIcon} aria-hidden="true" />
          {t.deliveryDetailsTitle}
        </span>
        <span className={styles.deliveryChevron} aria-hidden="true" />
      </summary>

      <div className={styles.deliveryBody}>
        {loading && <p className={styles.deliveryState}>{t.deliveryDetailsLoading}</p>}
        {!loading && error && <p className={styles.deliveryState}>{t.deliveryDetailsError}</p>}
        {!loading && !error && loaded && zones.length === 0 && (
          <p className={styles.deliveryState}>{t.deliveryDetailsEmpty}</p>
        )}

        {!loading &&
          !error &&
          zones.map((zone) => (
            <div className={styles.deliveryZone} key={zone.id}>
              <div className={styles.deliveryZoneName}>{zone.name}</div>
              <div className={styles.deliveryZoneCountries}>
                {formatCountryNames(zone.countryCodes, countryMap, t.deliveryDetailsWorldwide)}
              </div>
              <ul className={styles.deliveryMethodList}>
                {zone.methods.map((method) => (
                  <li className={styles.deliveryMethodRow} key={method.id}>
                    <span className={styles.deliveryMethodMain}>
                      <span className={styles.deliveryMethodName}>{method.name}</span>
                      {method.carrier && <span className={styles.deliveryMethodCarrier}>{method.carrier}</span>}
                    </span>
                    <span className={styles.deliveryMethodMeta}>
                      <span className={styles.deliveryMethodDays}>
                        {formatDays(method.estimatedDaysMin, method.estimatedDaysMax, t.deliveryDetailsDaysUnit)}
                      </span>
                      <span className={styles.deliveryMethodPrice}>
                        {method.priceCents === 0 ? t.deliveryDetailsFree : `${centsToEuros(method.priceCents)} €`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </details>
  );
}
