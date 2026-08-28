"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Package, Clock, Check, Search, X } from "lucide-react";
import styles from "./PickupPointSelector.module.css";

// Leaflet and its stylesheet load only when a pickup-point method is actually
// chosen — they stay out of the bundle for every other order.
const PickupPointMap = lazy(async () => {
  await import("leaflet/dist/leaflet.css");
  return import("./PickupPointMap");
});

export interface PickupPointOpeningDay {
  weekday: number;
  slots: string[];
}

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  postcode: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  openingHours: PickupPointOpeningDay[];
  type: "relay" | "locker";
  distanceMeters: number | null;
  carrierCode: string | null;
}

/** A place that has pickup points, from the backend's cached locality index. */
interface Locality {
  city: string;
  postcode: string;
  count: number;
}

const localityKey = (l: { city: string; postcode: string }) => `${l.postcode}|${l.city}`.toLowerCase();

interface Props {
  orderId: string;
  /** Already-chosen point, from the checkout snapshot. Null clears the UI back to search. */
  selected: PickupPoint | null;
  /** Prefills the first search so the customer usually doesn't have to type anything. */
  defaultPostcode: string;
  defaultCity: string;
  onSelect: (pickupPointId: string) => Promise<void>;
  labels: {
    title: string;
    intro: string;
    searchLabel: string;
    searchPlaceholder: string;
    noResults: string;
    error: string;
    selected: string;
    change: string;
    choose: string;
    openingHours: string;
    closed: string;
    relay: string;
    locker: string;
    suggestionsAria: string;
    resultsAria: string;
    typeMore: string;
    clear: string;
    mapAria: string;
    /** Contains "{place}", replaced with the chosen locality. */
    nearLabel: string;
    notOnMap: string;
    weekdays: string[];
  };
}

/** Suggestions come from a cached index, so one character is cheap enough to ask on. */
const MIN_SUGGEST_LENGTH = 1;
const SUGGEST_DEBOUNCE_MS = 150;
/** A real pickup-point search hits the carrier, so it waits for a steadier signal. */
const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;

function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Pickup-point picker with locality suggestions.
 *
 * Talks only to our own backend — the carrier's credentials never reach the
 * browser — and sends an id back up rather than a whole point: the server
 * re-reads every stored field from the carrier, so nothing rendered here is
 * trusted on the way back in.
 *
 * Two independent lookups run as the customer types. Locality suggestions come
 * from the backend's cached index and fire from the first character, because
 * they cost nothing at the carrier. The point search is slower-debounced and
 * needs two characters, because each one is a real carrier call.
 *
 * Suggestions are grounded in pickup-point data rather than a geocoder, so the
 * only places ever offered are places that actually have points — a general
 * address lookup would happily suggest a village with none — and no third-party
 * geo service sits on the checkout path.
 */
interface MapTilesConfig {
  tileUrl: string;
  attribution: string;
  enabled: boolean;
}

export default function PickupPointSelector({ orderId, selected, defaultPostcode, defaultCity, onSelect, labels }: Props) {
  const [term, setTerm] = useState(defaultPostcode || defaultCity);
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [locality, setLocality] = useState<Locality | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  /** Row the customer is pointing at, mirrored onto the map and back. */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapTiles, setMapTiles] = useState<MapTilesConfig | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);
  /** Last term actually sent to the carrier, so the same one is never sent twice. */
  const lastSearchedRef = useRef<string | null>(null);
  const comboRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query) return;
      lastSearchedRef.current = query;

      // Supersede any in-flight request so a slow early keystroke can't
      // overwrite the results of a later, more specific one.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setFailed(false);
      try {
        // A postcode is digits-and-spaces in every country these networks
        // serve; anything else is treated as a city so both work in one field.
        const params = new URLSearchParams({ orderId, limit: "20" });
        params.set(/^[\d\s-]+$/.test(query) ? "postcode" : "city", query);

        const res = await fetch(`/next-api/public/shop/shipping/pickup-points?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error("lookup failed");

        setPoints((await res.json()) as PickupPoint[]);
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // superseded, not a failure
        setPoints([]);
        setFailed(true);
      } finally {
        if (!controller.signal.aborted) {
          setSearched(true);
          setLoading(false);
        }
      }
    },
    [orderId],
  );

  const suggest = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query) return;

      suggestAbortRef.current?.abort();
      const controller = new AbortController();
      suggestAbortRef.current = controller;

      try {
        const params = new URLSearchParams({ orderId, q: query });
        const res = await fetch(`/next-api/public/shop/shipping/pickup-points/localities?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error("suggest failed");
        setLocalities((await res.json()) as Locality[]);
        setActive(-1);
      } catch {
        // Suggestions are an enhancement — a failure leaves the search working.
        if (!controller.signal.aborted) setLocalities([]);
      }
    },
    [orderId],
  );

  // Suggestions: cheap, so they start at the first character. Clearing happens
  // inside the timer too, so the effect body never sets state synchronously.
  useEffect(() => {
    clearTimeout(suggestDebounceRef.current);
    const query = term.trim();
    suggestDebounceRef.current = setTimeout(() => {
      if (query.length < MIN_SUGGEST_LENGTH) setLocalities([]);
      else void suggest(query);
    }, SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(suggestDebounceRef.current);
  }, [term, suggest]);

  // Points: one carrier call each, so slower and from two characters. Picking a
  // suggestion searches straight away and also sets the term, so the guard below
  // stops that turning into two identical calls.
  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    const query = term.trim();
    if (query.length < MIN_SEARCH_LENGTH || query === lastSearchedRef.current) return;

    searchDebounceRef.current = setTimeout(() => void search(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(searchDebounceRef.current);
  }, [term, search]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      suggestAbortRef.current?.abort();
    };
  }, [orderId]);

  // Fetched here rather than passed down, so only checkouts that reach a
  // pickup-point method pay for the request.
  useEffect(() => {
    let cancelled = false;
    void fetch("/next-api/public/platform-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg: { mapTiles?: MapTilesConfig } | null) => {
        if (!cancelled && cfg?.mapTiles) setMapTiles(cfg.mapTiles);
      })
      .catch(() => {
        // No map config, no map — the list is unaffected.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const suggestionsVisible = open && localities.length > 0;

  // A map is only worth showing when the carrier actually returned coordinates —
  // some networks omit them, and an empty basemap is worse than no map.
  const mappablePoints = useMemo(() => points.filter((p) => p.latitude !== null && p.longitude !== null), [points]);
  const showMap = mapTiles?.enabled === true && mappablePoints.length > 0;

  /** Clicking a marker brings its row into view and highlights it. */
  const focusPoint = useCallback((pointId: string) => {
    setActiveId(pointId);
    document.getElementById(`pickup-point-${pointId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  /**
   * A suggestion anchors the search on that postcode; it deliberately does NOT
   * filter the results afterwards. The carrier searches a radius around the
   * postcode, so the nearby points it returns — in neighbouring postcodes and
   * spellings — are exactly what the customer wants to see on the map. Filtering
   * them back out left the map showing one point, or none at all when the
   * index's spelling of a city differed from the search result's.
   */
  function pickLocality(item: Locality) {
    setLocality(item);
    setTerm(item.postcode);
    setOpen(false);
    setActive(-1);
    setExpandedId(null);
    void search(item.postcode);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault(); // the selector lives inside the shipping <form>
      if (suggestionsVisible && active >= 0 && localities[active]) pickLocality(localities[active]);
      else void search(term);
      return;
    }
    if (!suggestionsVisible) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, localities.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    }
  }

  async function handleChoose(point: PickupPoint) {
    setSelecting(point.id);
    try {
      await onSelect(point.id);
      setChanging(false);
    } finally {
      setSelecting(null);
    }
  }

  if (selected && !changing) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.selectedCard}>
          <span className={styles.selectedIcon} aria-hidden="true">
            <Check size={16} strokeWidth={2.5} />
          </span>
          <div className={styles.selectedBody}>
            <span className={styles.selectedLabel}>{labels.selected}</span>
            <span className={styles.pointName}>{selected.name}</span>
            <span className={styles.pointAddress}>
              {selected.address}, {selected.postcode} {selected.city}
            </span>
          </div>
          <button type="button" className={styles.changeBtn} onClick={() => setChanging(true)}>
            {labels.change}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{labels.title}</span>
        <span className={styles.headerIntro}>{labels.intro}</span>
      </div>

      <div className={styles.combo} ref={comboRef}>
        <div className={styles.searchRow}>
          <span className={styles.searchIcon} aria-hidden="true">
            <Search size={16} />
          </span>
          <input
            id="pickup-search"
            className={styles.searchInput}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setLocality(null);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.searchLabel}
            role="combobox"
            aria-expanded={suggestionsVisible}
            aria-controls="pickup-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 && localities[active] ? `pickup-locality-${active}` : undefined}
            autoComplete="off"
          />
          {term && (
            <button
              type="button"
              className={styles.clearBtn}
              aria-label={labels.clear}
              onClick={() => {
                setTerm("");
                setPoints([]);
                setLocality(null);
                setSearched(false);
                setOpen(false);
              }}
            >
              <X size={14} />
            </button>
          )}
          {loading && <span className={styles.spinner} aria-hidden="true" />}
        </div>

        {suggestionsVisible && (
          <ul className={styles.suggestions} id="pickup-suggestions" role="listbox" aria-label={labels.suggestionsAria}>
            {localities.map((item, index) => (
              <li key={localityKey(item)}>
                <button
                  type="button"
                  id={`pickup-locality-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={`${styles.suggestion} ${index === active ? styles.suggestionActive : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pickLocality(item)}
                >
                  <span className={styles.suggestionIcon} aria-hidden="true">
                    <MapPin size={14} />
                  </span>
                  <span className={styles.suggestionText}>
                    <span className={styles.suggestionCity}>{item.city}</span>
                    <span className={styles.suggestionPostcode}>{item.postcode}</span>
                  </span>
                  <span className={styles.suggestionCount}>{item.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {locality && !loading && points.length > 0 && (
        <p className={styles.anchorNote}>
          <MapPin size={13} aria-hidden="true" />
          {labels.nearLabel.replace("{place}", `${locality.city} · ${locality.postcode}`)}
        </p>
      )}

      {term.trim().length > 0 && term.trim().length < MIN_SEARCH_LENGTH && !suggestionsVisible && <p className={styles.empty}>{labels.typeMore}</p>}
      {failed && <p className={styles.error}>{labels.error}</p>}
      {!failed && searched && !loading && points.length === 0 && <p className={styles.empty}>{labels.noResults}</p>}

      <div className={showMap ? styles.split : undefined}>
        <ul className={styles.list} aria-label={labels.resultsAria} aria-busy={loading}>
          {points.map((point) => {
          const distance = formatDistance(point.distanceMeters);
          const expanded = expandedId === point.id;
          const mapIndex = mappablePoints.findIndex((p) => p.id === point.id);
          return (
            <li
              key={point.id}
              id={`pickup-point-${point.id}`}
              className={`${styles.item} ${activeId === point.id ? styles.itemActive : ""}`}
              onMouseEnter={() => setActiveId(point.id)}
              onMouseLeave={() => setActiveId(null)}
            >
              <div className={styles.itemMain}>
                <span className={styles.typeIcon} aria-hidden="true">
                  {showMap && mapIndex >= 0 ? <span className={styles.pinNumber}>{mapIndex + 1}</span> : point.type === "locker" ? <Package size={16} /> : <MapPin size={16} />}
                </span>
                <div className={styles.itemBody}>
                  <span className={styles.pointName}>{point.name}</span>
                  <span className={styles.pointAddress}>
                    {point.address}, {point.postcode} {point.city}
                  </span>
                  <span className={styles.pointMeta}>
                    <span className={styles.typeBadge}>{point.type === "locker" ? labels.locker : labels.relay}</span>
                    {distance && <span className={styles.distance}>{distance}</span>}
                    {/* The carrier gave no coordinates for this one, so it cannot
                        be placed. Said out loud rather than letting the list and
                        the map quietly disagree. */}
                    {showMap && mapIndex < 0 && <span className={styles.noMapNote}>{labels.notOnMap}</span>}
                    <button type="button" className={styles.hoursToggle} onClick={() => setExpandedId(expanded ? null : point.id)} aria-expanded={expanded}>
                      <Clock size={13} aria-hidden="true" /> {labels.openingHours}
                    </button>
                  </span>
                </div>
                <button type="button" className={styles.chooseBtn} onClick={() => void handleChoose(point)} disabled={selecting !== null}>
                  {selecting === point.id ? "…" : labels.choose}
                </button>
              </div>

              {expanded && (
                <dl className={styles.hours}>
                  {point.openingHours.map((day) => (
                    <div key={day.weekday} className={styles.hoursRow}>
                      <dt className={styles.hoursDay}>{labels.weekdays[day.weekday - 1]}</dt>
                      <dd className={styles.hoursSlots}>{day.slots.length ? day.slots.join(" · ") : labels.closed}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
          })}
        </ul>

        {showMap && mapTiles && (
          <div className={styles.mapPane}>
            <Suspense fallback={<div className={styles.mapSkeleton} aria-hidden="true" />}>
              <PickupPointMap
                points={mappablePoints}
                activeId={activeId}
                onMarkerClick={focusPoint}
                tileUrl={mapTiles.tileUrl}
                attribution={mapTiles.attribution}
                label={labels.mapAria}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
