"use client";

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { toBcp47, type Locale } from "@/lib/i18n";
import { readShipCountryHint, subscribeShipCountryHint } from "@/lib/shop/shipCountryHint";
import styles from "./CommerceHeader.module.css";

/** The shop's own country: a visitor there gets one line, not "Based in France · France: …". */
const ORIGIN_COUNTRY = "FR";

interface Destination {
  country: string | null;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
}

interface CachedDestination {
  hint: string | null;
  value: Destination;
}

/**
 * Once per browser session per hint: the answer only moves when the admin
 * edits shipping or the visitor changes country, and the header is on every
 * page — a request per navigation would be all cost.
 */
const CACHE_KEY = "silomis:ship-destination:v1";

function readCache(hint: string | null): Destination | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedDestination;
    return cached.hint === hint && cached.value && typeof cached.value === "object" ? cached.value : null;
  } catch {
    return null;
  }
}

function writeCache(hint: string | null, value: Destination): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ hint, value } satisfies CachedDestination));
  } catch {
    // Private mode / quota: the next page asks again, nothing breaks.
  }
}

/** "Spain" in the shop language — from the browser's own CLDR data, so no per-country strings to maintain. */
function countryName(code: string, locale: Locale): string | null {
  try {
    const name = new Intl.DisplayNames([toBcp47(locale)], { type: "region", fallback: "none" }).of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

function dayRange(min: number, max: number): string {
  return min === max ? String(max) : `${min}–${max}`;
}

/**
 * The strip above the header: where the shop ships from and, once known,
 * to the visitor's own country with a delivery window.
 *
 * Rendered generic on the server and swapped in after mount, never decided
 * server-side: the header sits in the shared layout, and reading the
 * visitor's IP there would make every storefront page per-visitor and
 * uncacheable. Every failure — no answer, a country the shop does not serve,
 * a browser without Intl.DisplayNames — leaves the generic line, which is
 * always true.
 */
export default function ShippingStrip({
  locale,
  generic,
  originBased,
  shipToCountry,
}: {
  locale: Locale;
  generic: string;
  originBased: string;
  shipToCountry: string;
}) {
  const [destination, setDestination] = useState<Destination | null>(null);

  useEffect(() => {
    let controller: AbortController | null = null;

    const load = () => {
      controller?.abort();
      const hint = readShipCountryHint();
      const cached = readCache(hint);
      if (cached) {
        setDestination(cached);
        return;
      }

      const ac = new AbortController();
      controller = ac;
      const qs = hint ? `?country=${hint}` : "";
      fetch(`/next-api/public/shop/shipping/destination${qs}`, { signal: ac.signal })
        .then((r) => (r.ok ? (r.json() as Promise<Destination>) : null))
        .then((value) => {
          if (!value || ac.signal.aborted) return;
          writeCache(hint, value);
          setDestination(value);
        })
        .catch(() => {
          // Offline, aborted, or the API is down: the generic line stays.
        });
    };

    load();
    const unsubscribe = subscribeShipCountryHint(load);
    return () => {
      unsubscribe();
      controller?.abort();
    };
  }, []);

  const flag = (
    <svg className={styles.originFlag} viewBox="0 0 3 2" aria-hidden="true">
      <rect width="3" height="2" fill="#ED2939" />
      <rect width="2" height="2" fill="#fff" />
      <rect width="1" height="2" fill="#002395" />
    </svg>
  );

  const code = destination?.country ?? null;
  const name = code ? countryName(code, locale) : null;
  const min = destination?.deliveryDaysMin;
  const max = destination?.deliveryDaysMax;

  if (!code || !name || !min || !max) {
    return (
      <div className={styles.originStrip}>
        {flag}
        <span className={styles.originText}>{generic}</span>
      </div>
    );
  }

  const deliveryLine = shipToCountry.replace("{country}", name).replace("{range}", dayRange(min, max));

  if (code === ORIGIN_COUNTRY) {
    return (
      <div className={`${styles.originStrip} ${styles.originStripResolved}`}>
        {flag}
        <span className={styles.originText}>{deliveryLine}</span>
      </div>
    );
  }

  return (
    <div className={`${styles.originStrip} ${styles.originStripResolved}`}>
      {/* Origin is dropped on phones: one line has room for the destination
          only, and the destination is the part a visitor is checking for. */}
      <span className={styles.originPart}>
        {flag}
        <span>{originBased}</span>
        <span className={styles.originSep} aria-hidden="true">·</span>
      </span>
      <Truck className={styles.destinationIcon} size={14} strokeWidth={2} aria-hidden="true" />
      <span className={styles.originText}>{deliveryLine}</span>
    </div>
  );
}
