"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import type { PickupPoint } from "./PickupPointSelector";
import styles from "./PickupPointMap.module.css";

interface Props {
  points: PickupPoint[];
  /** Emphasised marker — the row the customer is hovering or has chosen. */
  activeId: string | null;
  onMarkerClick: (pointId: string) => void;
  tileUrl: string;
  attribution: string;
  /** Accessible name; the map itself is decorative next to the list. */
  label: string;
}

/**
 * Leaflet map of the current pickup points.
 *
 * Deliberately a companion to the list, never a replacement: every point is
 * selectable from the list alone, so a blocked tile host, a failed dynamic
 * import or a screen reader all leave checkout fully usable. That is why the
 * container is aria-hidden and carries no interactive contract of its own.
 *
 * Leaflet is imported dynamically by the parent so it stays out of the main
 * checkout bundle for the majority of orders that never use a pickup point.
 */
export default function PickupPointMap({ points, activeId, onMarkerClick, tileUrl, attribution, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  /**
   * State, not just the ref: Leaflet is imported asynchronously, and assigning
   * a ref inside the .then() does not re-render. Without this the marker effect
   * could run once while the map was still loading, bail out, and never run
   * again — leaving a full list beside an empty map.
   */
  const [mapReady, setMapReady] = useState(false);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  // Kept in a ref so re-rendering with a new handler doesn't rebind every
  // marker. Assigned in an effect, never during render.
  const onMarkerClickRef = useRef(onMarkerClick);
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  // ── Create once, destroy on unmount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      map = L.map(containerRef.current, {
        zoomControl: true,
        // Wheel-zoom without a modifier hijacks page scrolling on a long
        // checkout page; Leaflet's own hint tells the customer what to do.
        scrollWheelZoom: false,
        attributionControl: true,
      }).setView([48.8566, 2.3522], 12);

      L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });

    const markers = markersRef.current;
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markers.clear();
      setMapReady(false);
    };
    // Re-creating on a tile change is correct and vanishingly rare.
  }, [tileUrl, attribution]);

  // ── Sync markers with the current results ────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      for (const marker of markersRef.current.values()) marker.remove();
      markersRef.current.clear();

      const located = points.filter((p) => p.latitude !== null && p.longitude !== null);
      if (!located.length) return;

      located.forEach((point, index) => {
        const marker = L.marker([point.latitude as number, point.longitude as number], {
          // Numbered so a marker and its list row are unambiguously the same
          // point — colour alone would not survive a colour-blind viewer.
          icon: L.divIcon({
            className: "",
            html: `<span class="${styles.pin}" data-point-id="${point.id}">${index + 1}</span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
          keyboard: false, // the list is the keyboard path
          title: `${point.name} — ${point.postcode} ${point.city}`,
        })
          .addTo(map)
          .on("click", () => onMarkerClickRef.current(point.id));

        markersRef.current.set(point.id, marker);
      });

      // A single point (or several at the same address) gives a zero-area
      // bounds, which fitBounds resolves to its maximum zoom — far too close to
      // be useful. Centre those instead.
      const bounds = L.latLngBounds(located.map((p) => [p.latitude as number, p.longitude as number]));
      if (located.length === 1 || !bounds.isValid() || bounds.getNorthEast().equals(bounds.getSouthWest())) {
        map.setView(bounds.getCenter(), 15);
      } else {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [points, mapReady]);

  // ── Follow the active row ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    for (const [id, marker] of markersRef.current) {
      const el = marker.getElement()?.querySelector(`.${styles.pin}`);
      el?.classList.toggle(styles.pinActive, id === activeId);
    }

    const map = mapRef.current;
    const active = activeId ? markersRef.current.get(activeId) : null;
    if (map && active) {
      active.setZIndexOffset(1000);
      // Pan only when it is actually off-screen — a jump on every hover is
      // disorienting.
      if (!map.getBounds().contains(active.getLatLng())) map.panTo(active.getLatLng(), { animate: true });
    }
  }, [activeId, points, mapReady]);

  return <div ref={containerRef} className={styles.map} role="presentation" aria-label={label} />;
}
