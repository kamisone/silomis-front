"use client";

import { useCallback, useState } from "react";
import { Check, Loader2, PackageCheck, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Select from "@/components/admin/ui/Select";
import MediaPicker from "@/components/admin/ui/MediaPicker";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./SendInJobPanel.module.css";

export const SEND_IN_STATUSES = ["awaiting_item", "received", "in_production", "done", "returned", "delivered", "problem", "cancelled"] as const;
export type SendInStatus = (typeof SEND_IN_STATUSES)[number];

export const SEND_IN_LABEL: Record<SendInStatus, string> = {
  awaiting_item: "Waiting for the item",
  received: "Received",
  in_production: "In production",
  done: "Embroidery done",
  returned: "Sent back",
  delivered: "Delivered",
  problem: "Problem",
  cancelled: "Cancelled",
};

/** What the desk does next, as a verb. */
const NEXT: Partial<Record<SendInStatus, { next: SendInStatus; label: string }>> = {
  awaiting_item: { next: "received", label: "Mark received" },
  received: { next: "in_production", label: "Start production" },
  in_production: { next: "done", label: "Mark done" },
  done: { next: "returned", label: "Mark sent back" },
  returned: { next: "delivered", label: "Mark delivered" },
};

/** Steps that must come with a photograph — the item as it arrived, and the finished piece. */
const PHOTO_REQUIRED: SendInStatus[] = ["received", "done"];

export interface SendInJob {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  orderedAt: string;
  customerName: string | null;
  customerEmail: string;
  itemType: string;
  itemLabel: string;
  note: string | null;
  panelWidthMm: number;
  panelHeightMm: number;
  photos: { key: string; url: string }[];
  /** Their photo with the design drawn on it, as they saw it. Null until rendered. */
  mockupUrl: string | null;
  /** Every side they photographed, in the order they added them, each with its own design. */
  sides: {
    placementKey: string;
    photoUrl: string;
    mockupUrl: string | null;
    design: { id: string; text: string; productionStatus: string; stitchEstimate: number } | null;
  }[];
  status: SendInStatus;
  allowedNext: SendInStatus[];
  returnCarrier: string | null;
  returnTrackingNumber: string | null;
  returnTrackingUrl: string | null;
  designs: { id: string; text: string; productionStatus: string; stitchEstimate: number }[];
  events: { id: string; status: string; note: string | null; photos: { key: string; url: string }[]; at: string }[];
  updatedAt: string;
}

/**
 * One send-in job: the customer's item and what they told us, and the desk's
 * side of the round trip — move it along, say something, show a photograph.
 * The customer sees every step of this on their tracking page and gets each
 * status change in their inbox, so what is written here is written to them.
 */
export function SendInJobPanel({ job, onChange, showOrder = true }: { job: SendInJob; onChange: (job: SendInJob) => void; showOrder?: boolean }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<SendInStatus>(job.status);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<{ key: string; url: string }[]>([]);
  const [carrier, setCarrier] = useState(job.returnCarrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(job.returnTrackingNumber ?? "");
  const [trackingUrl, setTrackingUrl] = useState(job.returnTrackingUrl ?? "");
  const [redrawing, setRedrawing] = useState(false);

  /** Draws the mockup again from the stored photo and design — for a job whose render failed at order time. */
  const redraw = useCallback(async () => {
    setRedrawing(true);
    try {
      onChange(await api.post<SendInJob>(`/next-api/admin/shop/send-in/${job.id}/mockup`, {}));
    } catch {
      toast.error("Could not draw the preview.");
    } finally {
      setRedrawing(false);
    }
  }, [job.id, onChange, toast]);

  const changingStatus = status !== job.status;
  const needsPhoto = changingStatus && PHOTO_REQUIRED.includes(status) && photos.length === 0;
  const needsTracking = changingStatus && status === "returned" && !trackingNumber.trim();
  const dirty = changingStatus || note.trim() || photos.length || carrier !== (job.returnCarrier ?? "") || trackingNumber !== (job.returnTrackingNumber ?? "") || trackingUrl !== (job.returnTrackingUrl ?? "");

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const updated = await api.patch<SendInJob>(`/next-api/admin/shop/send-in/${job.id}`, {
        ...(changingStatus ? { status } : {}),
        note: note.trim() || null,
        photoKeys: photos.map((p) => p.key),
        returnCarrier: carrier.trim() || null,
        returnTrackingNumber: trackingNumber.trim() || null,
        returnTrackingUrl: trackingUrl.trim() || null,
      });
      onChange(updated);
      setStatus(updated.status);
      setNote("");
      setPhotos([]);
      toast.success(changingStatus ? `Marked "${SEND_IN_LABEL[updated.status]}" — the customer has been emailed` : "Saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Could not update the job") : "Could not update the job");
    } finally {
      setBusy(false);
    }
  }, [job.id, changingStatus, status, note, photos, carrier, trackingNumber, trackingUrl, onChange, toast]);

  const next = NEXT[job.status];
  const options = [job.status, ...job.allowedNext].map((s) => ({ value: s, label: SEND_IN_LABEL[s] }));

  return (
    <article className={styles.panel}>
      <header className={styles.head}>
        <div className={styles.headMain}>
          {showOrder ? (
            <a className={styles.orderLink} href={`/admin/shop/orders/${job.orderId}`}>
              {job.orderNumber}
            </a>
          ) : (
            <span className={styles.itemTitle}>
              <PackageCheck size={15} aria-hidden="true" /> Customer&apos;s own item
            </span>
          )}
          <span className={styles.meta}>
            {job.itemLabel} · panel {Math.round(job.panelWidthMm)} × {Math.round(job.panelHeightMm)} mm
            {showOrder && job.customerName && ` · ${job.customerName}`}
          </span>
        </div>
        <span className={`${styles.badge} ${styles[`badge_${job.status}`]}`}>{SEND_IN_LABEL[job.status]}</span>
      </header>

      <div className={styles.body}>
        {/* The customer's side: each side of the item, with the design on
            their photo as they placed it, the bare photo, and the words. */}
        <div className={styles.customer}>
          <div className={styles.sides}>
            {job.sides.map((sd, i) => (
              <div key={sd.placementKey} className={styles.side}>
                <span className={styles.sideHead}>
                  Side {i + 1}
                </span>
                <div className={styles.customerPhotos}>
                  {sd.mockupUrl ? (
                    <a href={sd.mockupUrl} target="_blank" rel="noopener noreferrer" className={styles.mockup} title="The design as the customer placed it">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sd.mockupUrl} alt="" />
                      <span className={styles.mockupTag}>As the customer placed it</span>
                    </a>
                  ) : (
                    <button type="button" className={styles.redraw} onClick={() => void redraw()} disabled={redrawing}>
                      {redrawing ? <Loader2 size={14} className={styles.spin} aria-hidden="true" /> : null}
                      {redrawing ? "Drawing…" : "Draw the customer's preview"}
                    </button>
                  )}
                  <a href={sd.photoUrl} target="_blank" rel="noopener noreferrer" className={styles.photo} title="Open the customer's photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sd.photoUrl} alt="" />
                  </a>
                </div>
                {sd.design && <p className={styles.sideText}>{sd.design.text}</p>}
              </div>
            ))}
          </div>
          <div className={styles.customerText}>
            <span className={styles.label}>Customer&apos;s note</span>
            <p className={styles.note}>{job.note || <span className={ui.muted}>—</span>}</p>
          </div>
        </div>

        {/* The desk's side: the history so far. */}
        <ol className={styles.timeline}>
          {job.events.map((e) => (
            <li key={e.id} className={styles.event}>
              <span className={styles.eventStatus}>{SEND_IN_LABEL[e.status as SendInStatus] ?? e.status}</span>
              <span className={styles.eventDate}>{new Date(e.at).toLocaleString()}</span>
              {e.note && <p className={styles.eventNote}>{e.note}</p>}
              {e.photos.length > 0 && (
                <div className={styles.eventPhotos}>
                  {e.photos.map((p) => (
                    <a key={p.key} href={p.url} target="_blank" rel="noopener noreferrer" className={styles.photoSmall}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" />
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>

        {/* Moving it along. Everything here goes to the customer. */}
        {job.status !== "delivered" && job.status !== "cancelled" && (
          <div className={styles.form}>
            <div className={styles.formRow}>
              <label className={styles.field}>
                <span className={styles.label}>Status</span>
                <Select<SendInStatus> value={status} options={options} onChange={setStatus} ariaLabel="Send-in status" disabled={busy} />
              </label>
              {next && !changingStatus && (
                <button type="button" className={styles.nextBtn} onClick={() => setStatus(next.next)} disabled={busy}>
                  <Check size={14} aria-hidden="true" /> {next.label}
                </button>
              )}
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Message to the customer</span>
              <textarea
                className={ui.textarea}
                rows={2}
                value={note}
                placeholder={status === "problem" ? "What is wrong, and what you propose." : "Optional — shown on their tracking page and in the email."}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            <div className={styles.field}>
              <span className={styles.label}>
                Photos for the customer
                {PHOTO_REQUIRED.includes(status) && changingStatus && <span className={styles.required}> · required for “{SEND_IN_LABEL[status]}”</span>}
              </span>
              <div className={styles.photoRow}>
                {photos.map((p) => (
                  <span key={p.key} className={styles.photoSmall}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" />
                    <button type="button" className={styles.photoRemove} onClick={() => setPhotos((prev) => prev.filter((x) => x.key !== p.key))} aria-label="Remove photo">
                      <X size={11} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <MediaPicker
                  value={null}
                  mediaType="image"
                  multi
                  asAddTile
                  className={styles.addTile}
                  onSelectMulti={(assets) => setPhotos((prev) => [...prev, ...assets.filter((a) => !prev.some((p) => p.key === a.storageKey)).map((a) => ({ key: a.storageKey, url: a.url }))])}
                />
              </div>
            </div>

            {(status === "returned" || status === "done" || job.returnTrackingNumber) && (
              <div className={styles.formRow}>
                <label className={styles.field}>
                  <span className={styles.label}>Return carrier</span>
                  <input className={ui.input} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Colissimo" />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Tracking number{status === "returned" && changingStatus && <span className={styles.required}> · required</span>}</span>
                  <input className={ui.input} value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Tracking URL</span>
                  <input className={ui.input} value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://…" />
                </label>
              </div>
            )}

            <div className={styles.formActions}>
              {needsPhoto && <span className={styles.warn}>Add a photo before marking it “{SEND_IN_LABEL[status]}”.</span>}
              {needsTracking && <span className={styles.warn}>Enter the tracking number first.</span>}
              <button type="button" className={styles.saveBtn} onClick={() => void save()} disabled={busy || !dirty || needsPhoto || needsTracking}>
                {busy ? <Loader2 size={14} className={styles.spin} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                {changingStatus ? `Mark “${SEND_IN_LABEL[status]}” & notify` : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
