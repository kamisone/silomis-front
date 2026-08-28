"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Truck, AlertTriangle, Map } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./Integrations.module.css";

/** Status only — the API never returns a stored secret, by design. */
interface CredentialStatus {
  provider: string;
  isConfigured: boolean;
  /** False when the server has no valid INTEGRATION_CREDENTIALS_MASTER_KEY, so saving would fail. */
  encryptionReady: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface MapTilesConfig {
  tileUrl: string;
  attribution: string;
  enabled: boolean;
}

interface ShippingMethod {
  id: string;
  code: string | null;
  name: string;
  isActive: boolean;
  requiresPickupPoint: boolean;
  supportedCountryCodes: string[];
  carrierCode: string | null;
}

const SENDCLOUD = "sendcloud";
/** Methods whose pickup points Sendcloud serves — used only for the readiness summary. */
const PICKUP_METHOD_CODES = ["mondial_relay", "colissimo"];

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

function ChecklistItem({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className={styles.checkItem}>
      <span className={`${styles.checkIcon} ${done ? styles.checkDone : styles.checkPending}`} aria-hidden="true">
        {done ? <Check size={12} strokeWidth={3} /> : <AlertTriangle size={11} strokeWidth={2.5} />}
      </span>
      <span className={styles.checkText}>{children}</span>
    </li>
  );
}

export default function ShippingIntegrationsPage() {
  const { toast } = useToast();

  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");

  const [map, setMap] = useState<MapTilesConfig>({ tileUrl: "", attribution: "", enabled: true });
  const [savingMap, setSavingMap] = useState(false);

  const load = useCallback(async () => {
    const [credential, allMethods, platform] = await Promise.all([
      api.get<CredentialStatus>(`/next-api/admin/integration-credentials/${SENDCLOUD}`).catch(() => null),
      api.get<ShippingMethod[]>("/next-api/admin/shop/shipping/methods").catch(() => [] as ShippingMethod[]),
      api.get<{ mapTiles?: MapTilesConfig }>("/next-api/public/platform-settings").catch(() => null),
    ]);
    setStatus(credential);
    if (platform?.mapTiles) setMap(platform.mapTiles);
    setMethods(allMethods.filter((m) => m.requiresPickupPoint || PICKUP_METHOD_CODES.includes(m.code ?? "")));
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function save() {
    if (!publicKey.trim() || !secretKey.trim()) {
      toast.error("Both API keys are required");
      return;
    }
    setSaving(true);
    try {
      const next = await api.put<CredentialStatus>(`/next-api/admin/integration-credentials/${SENDCLOUD}`, {
        publicKey: publicKey.trim(),
        secretKey: secretKey.trim(),
      });
      setStatus(next);
      // Nothing can repopulate these — the secret is never sent back.
      setPublicKey("");
      setSecretKey("");
      toast.success("Sendcloud credentials saved");
    } catch (err) {
      toast.error(errMessage(err, "Could not save the credentials"));
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    setClearing(true);
    try {
      setStatus(await api.delete<CredentialStatus>(`/next-api/admin/integration-credentials/${SENDCLOUD}`));
      toast.success("Sendcloud credentials removed");
    } catch (err) {
      toast.error(errMessage(err, "Could not remove the credentials"));
    } finally {
      setClearing(false);
    }
  }

  async function saveMap() {
    setSavingMap(true);
    try {
      const next = await api.put<{ mapTiles?: MapTilesConfig }>("/next-api/admin/platform-settings/map-tiles", map);
      if (next?.mapTiles) setMap(next.mapTiles);
      toast.success("Map settings saved");
    } catch (err) {
      toast.error(errMessage(err, "Could not save the map settings"));
    } finally {
      setSavingMap(false);
    }
  }

  const configured = status?.isConfigured === true;
  const activeMethods = methods.filter((m) => m.isActive);
  const encryptionBroken = status !== null && !status.encryptionReady;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.pageTitle}>Carrier Integrations</h1>
          <p className={styles.intro}>Connect a carrier account so the storefront can look up its pickup points during checkout.</p>
        </div>
      </div>

      <div className={`${ui.card} ${styles.carrierCard}`}>
        <header className={styles.carrierHeader}>
          <span className={styles.carrierMark} aria-hidden="true">
            <Truck size={20} strokeWidth={1.75} />
          </span>
          <div className={styles.carrierHeading}>
            <h2 className={styles.carrierName}>
              Sendcloud
              <span className={configured ? ui.badgeActive : ui.badgeInactive}>{loading ? "…" : configured ? "connected" : "not connected"}</span>
            </h2>
            <p className={styles.carrierPurpose}>
              Serves pickup points for every carrier enabled on your Sendcloud account — Mondial Relay, Colissimo and others — through one key pair. Keys
              are encrypted before storage and never shown again.
            </p>
          </div>
        </header>

        {!loading && (
          <ul className={styles.checklist}>
            <ChecklistItem done={configured}>{configured ? "API keys stored" : "Add your API keys below"}</ChecklistItem>
            <ChecklistItem done={activeMethods.length > 0}>
              {activeMethods.length > 0 ? (
                <>
                  {activeMethods.length} pickup-point method{activeMethods.length === 1 ? "" : "s"} active
                  <span className={styles.checkHint}>
                    {activeMethods.map((m) => `${m.name}${m.carrierCode ? ` (${m.carrierCode})` : " — no carrier code set"}`).join(" · ")}
                  </span>
                </>
              ) : (
                <>
                  No pickup-point method is active
                  <span className={styles.checkHint}>
                    Turn one on in{" "}
                    <Link href="/admin/shop/shipping" className={styles.checkLink}>
                      Shipping Config
                    </Link>{" "}
                    — until then no pickup point is ever offered at checkout.
                  </span>
                </>
              )}
            </ChecklistItem>
            <ChecklistItem done={configured && activeMethods.length > 0}>
              Enable each method per product
              <span className={styles.checkHint}>A basket is offered a pickup-point method only when every product in it has that method ticked.</span>
            </ChecklistItem>
          </ul>
        )}

        <div className={styles.form}>
          <h3 className={styles.formTitle}>{configured ? "Replace API keys" : "API keys"}</h3>

          {encryptionBroken && (
            <p className={`${styles.banner} ${styles.bannerError}`}>
              This server has no valid <code>INTEGRATION_CREDENTIALS_MASTER_KEY</code>, so secrets cannot be encrypted. Saving will fail until one is
              configured.
            </p>
          )}

          <div className={styles.fieldRow}>
            <div className={ui.field}>
              <label className={ui.label} htmlFor="sc-public">
                Public key
              </label>
              <input
                id="sc-public"
                className={ui.input}
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder={configured ? "Enter a new value to replace" : "From your Sendcloud integration"}
                autoComplete="off"
                spellCheck={false}
                disabled={loading}
              />
            </div>

            <div className={ui.field}>
              <label className={ui.label} htmlFor="sc-secret">
                Secret key
              </label>
              <input
                id="sc-secret"
                className={ui.input}
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={configured ? "Enter a new value to replace" : "Shown only once by Sendcloud"}
                autoComplete="new-password"
                spellCheck={false}
                disabled={loading}
              />
            </div>
          </div>

          <p className={styles.fieldHint}>
            Enable <strong>Service Points</strong> on the integration in Sendcloud, and select the carriers you want offered. A method&rsquo;s carrier code
            in Shipping Config decides which of them it shows.
          </p>

          <div className={styles.actions}>
            <Button onClick={save} disabled={saving || loading}>
              {saving ? "Saving…" : configured ? "Replace" : "Save"}
            </Button>
            {configured && (
              <Button variant="danger" onClick={clear} disabled={clearing}>
                {clearing ? "Removing…" : "Remove"}
              </Button>
            )}
            <span className={styles.meta}>
              {loading
                ? "Loading…"
                : configured
                  ? `Updated ${status?.updatedAt ? new Date(status.updatedAt).toLocaleDateString() : "—"}${status?.updatedBy ? ` by ${status.updatedBy}` : ""}`
                  : "No credentials stored"}
            </span>
          </div>
        </div>
      </div>

      <div className={`${ui.card} ${styles.carrierCard}`} style={{ marginTop: "1.25rem" }}>
        <header className={styles.carrierHeader}>
          <span className={styles.carrierMark} aria-hidden="true">
            <Map size={20} strokeWidth={1.75} />
          </span>
          <div className={styles.carrierHeading}>
            <h2 className={styles.carrierName}>
              Pickup-point map
              <span className={map.enabled ? ui.badgeActive : ui.badgeInactive}>{map.enabled ? "shown" : "hidden"}</span>
            </h2>
            <p className={styles.carrierPurpose}>The basemap drawn behind pickup points at checkout. Turning it off leaves the list, which works on its own.</p>
          </div>
        </header>

        <div className={styles.form}>
          <p className={`${styles.banner} ${styles.bannerInfo}`}>
            Defaults to OpenStreetMap so the map works immediately. Their tile policy discourages commercial use, so point this at a keyed provider
            (MapTiler, Stadia, Carto) before real traffic. A tile key is domain-restricted and public by design — it belongs here, not in the encrypted
            credential store.
          </p>

          <div className={ui.field}>
            <label className={ui.label} htmlFor="map-url">
              Tile URL
            </label>
            <input
              id="map-url"
              className={ui.input}
              value={map.tileUrl}
              onChange={(e) => setMap({ ...map, tileUrl: e.target.value })}
              placeholder="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />
            <p className={styles.fieldHint}>Must be https and contain {"{z}"}, {"{x}"} and {"{y}"}.</p>
          </div>

          <div className={ui.field}>
            <label className={ui.label} htmlFor="map-attribution">
              Attribution
            </label>
            <input
              id="map-attribution"
              className={ui.input}
              value={map.attribution}
              onChange={(e) => setMap({ ...map, attribution: e.target.value })}
              placeholder="© OpenStreetMap contributors"
              disabled={loading}
            />
            <p className={styles.fieldHint}>Shown over the map. Most providers require it — do not leave it blank.</p>
          </div>

          <label className={styles.toggleRow}>
            <input type="checkbox" checked={map.enabled} onChange={(e) => setMap({ ...map, enabled: e.target.checked })} />
            Show the map at checkout
          </label>

          <div className={styles.actions}>
            <Button onClick={saveMap} disabled={savingMap || loading}>
              {savingMap ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
