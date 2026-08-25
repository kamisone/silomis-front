"use client";

import { useState } from "react";
import { Truck, CheckCircle2 } from "lucide-react";
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

interface FreeShippingUpgradeMethod {
  id: string;
  name: string;
  carrier: string | null;
  priceCents: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isActive?: boolean;
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
  freeShippingDaysMin?: number | null;
  freeShippingDaysMax?: number | null;
  freeShippingUpgradeMethods?: FreeShippingUpgradeMethod[];
}

export default function DeliveryDetails({
  locale,
  freeShipping,
  freeShippingDaysMin,
  freeShippingDaysMax,
  freeShippingUpgradeMethods,
}: Props) {
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

  const activeUpgrades = (freeShippingUpgradeMethods ?? []).filter((m) => m.isActive !== false);

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
        {freeShipping && (
          <>
            <p className={styles.deliveryFreeBanner}>
              <CheckCircle2 size={16} className={styles.deliveryFreeIcon} aria-hidden="true" />
              {t.freeShippingBadge}
              {freeShippingDaysMax != null && (
                <>
                  {" "}
                  · {formatDays(freeShippingDaysMin ?? freeShippingDaysMax, freeShippingDaysMax, t.deliveryDetailsDaysUnit)}
                </>
              )}
            </p>

            {activeUpgrades.length > 0 && (
              <div className={styles.deliveryUpgrades}>
                <p className={styles.deliveryUpgradesTitle}>{t.deliveryDetailsUpgradesTitle}</p>
                <ul className={styles.deliveryUpgradeList}>
                  {activeUpgrades.map((method) => (
                    <li className={styles.deliveryUpgradeRow} key={method.id}>
                      <span className={styles.deliveryUpgradeMain}>
                        <span className={styles.deliveryUpgradeName}>{method.name}</span>
                        <span className={styles.deliveryUpgradeTag}>{t.deliveryDetailsUpgradeTag}</span>
                      </span>
                      <span className={styles.deliveryUpgradeMeta}>
                        <span className={styles.deliveryUpgradeDays}>
                          {formatDays(method.estimatedDaysMin, method.estimatedDaysMax, t.deliveryDetailsDaysUnit)}
                        </span>
                        <span className={styles.deliveryUpgradePrice}>{`${centsToEuros(method.priceCents)} €`}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

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
