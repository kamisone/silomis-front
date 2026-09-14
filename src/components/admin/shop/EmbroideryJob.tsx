"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Download, FileDown, Loader2, Printer, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Select from "@/components/admin/ui/Select";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./EmbroideryJob.module.css";

/** The order the floor works a job, mirroring the backend's list. */
export const PRODUCTION_STATUSES = ["pending", "digitizing", "ready", "stitched"] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const STATUS_LABEL: Record<ProductionStatus, string> = {
  pending: "To digitise",
  digitizing: "Digitising",
  ready: "Ready to stitch",
  stitched: "Stitched",
};

/** What the operator does next, as a verb — the primary button on each card. */
const NEXT_ACTION: Record<ProductionStatus, { next: ProductionStatus; label: string } | null> = {
  pending: { next: "digitizing", label: "Start digitising" },
  digitizing: { next: "ready", label: "Mark ready" },
  ready: { next: "stitched", label: "Mark stitched" },
  stitched: null,
};

export interface ThreadColor {
  brand: string;
  code: string;
  name: string;
  hex: string;
}

/** One job, exactly as `GET admin/shop/personalization/queue` returns it. */
export interface EmbroideryJob {
  id: string;
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  orderStatus: string;
  orderedAt: string;
  customerName: string | null;
  productTitle: string;
  sku: string | null;
  options: { attributeName: string; value: string; displayValue: string | null }[];
  quantity: number;
  placementKey: string;
  placementLabel: string;
  contentType: "text" | "monogram" | "motif";
  text: string;
  fontName: string;
  fontWeight: number;
  heightMm: number;
  fieldWidthMm: number;
  fieldHeightMm: number;
  offsetXMm: number;
  offsetYMm: number;
  rotationDeg: number;
  lineCount: number;
  curveDeg: number;
  trackingPct: number;
  hasOutline: boolean;
  outlineThread: ThreadColor | null;
  isPuff: boolean;
  motifKey: string | null;
  motifName: string | null;
  motifSizeMm: number | null;
  threadColors: ThreadColor[];
  stitchEstimate: number;
  priceCents: number;
  productionStatus: ProductionStatus;
  productionNote: string | null;
  stitchFileKey: string | null;
  digitizedAt: string | null;
  hasArtwork: boolean;
  /** Every box in the hoop — what the operator sews, one by one. */
  elements: EmbroideryJobElement[];
}

export interface EmbroideryJobElement {
  contentType: "text" | "monogram" | "motif";
  text: string;
  lineCount: number;
  fontName: string;
  fontWeight: number;
  heightMm: number;
  curveDeg: number;
  isPuff: boolean;
  motifName: string | null;
  motifSizeMm: number | null;
  thread: ThreadColor;
  offsetXMm: number;
  offsetYMm: number;
  rotationDeg: number;
  stitchEstimate: number;
}

/** Orders the floor may actually work. Mirrors the backend's queue filter. */
const WORKABLE_ORDER_STATUSES = new Set(["paid", "processing", "shipped", "delivered"]);

const WEIGHT_NAME: Record<number, string> = { 300: "Light", 400: "Regular", 500: "Medium", 700: "Bold", 900: "Extra bold" };

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

function mm(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} mm`;
}

/**
 * One embroidery job, as a card.
 *
 * Built for someone standing at a machine, not sitting at a desk: the text to
 * be stitched is the largest thing on the card, the thread codes are the
 * supplier's own so they can be read straight onto a spool, and one button
 * moves the job to its next state. Everything shown was frozen when the order
 * was placed — nothing re-reads the live catalogue, because a thread retired
 * last week must not change a job already on the floor.
 *
 * The same card serves the production queue and the order page, so the two
 * never disagree about what a job looks like.
 */
export function EmbroideryJobCard({
  job,
  onChange,
  showOrder = true,
}: {
  job: EmbroideryJob;
  /** Called with the updated row after any save, so the parent list stays current. */
  onChange: (job: EmbroideryJob) => void;
  /** Hide the order line when the card already sits on that order's page. */
  showOrder?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"status" | "note" | "file" | null>(null);
  // Drafts are null until the operator types: the saved value shows through
  // until then, so a save elsewhere (the queue refreshing) is never overwritten
  // by a stale copy held here.
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [fileDraft, setFileDraft] = useState<string | null>(null);
  const [artworkOpen, setArtworkOpen] = useState(false);
  const note = noteDraft ?? job.productionNote ?? "";
  const fileKey = fileDraft ?? job.stitchFileKey ?? "";

  const patch = useCallback(
    async (kind: "status" | "note" | "file", body: Record<string, unknown>, done: string) => {
      setBusy(kind);
      try {
        const updated = await api.patch<EmbroideryJob>(`/next-api/admin/shop/personalization/queue/${job.id}`, body);
        if (kind === "note") setNoteDraft(null);
        if (kind === "file") setFileDraft(null);
        onChange(updated);
        toast.success(done);
      } catch {
        toast.error("Could not update that job.");
      } finally {
        setBusy(null);
      }
    },
    [job.id, onChange, toast],
  );

  const action = NEXT_ACTION[job.productionStatus];
  const workable = WORKABLE_ORDER_STATUSES.has(job.orderStatus);

  // The hoop itself: how far it was moved from the traced centre. A moved
  // hoop is the one thing a centred hooping gets wrong.
  const moved = Math.abs(job.offsetXMm) >= 0.05 || Math.abs(job.offsetYMm) >= 0.05;
  const placement = moved
    ? `hooped ${job.offsetXMm > 0 ? "+" : ""}${job.offsetXMm.toFixed(1)} / ${job.offsetYMm > 0 ? "+" : ""}${job.offsetYMm.toFixed(1)} mm from centre`
    : "hooped on the traced centre";

  const noteDirty = note.trim() !== (job.productionNote ?? "");
  const fileDirty = fileKey.trim() !== (job.stitchFileKey ?? "");

  return (
    <article className={styles.job} aria-label={`Embroidery job ${job.orderNumber} ${job.placementLabel}`}>
      <header className={styles.jobHead}>
        <div className={styles.jobHeadMain}>
          {showOrder ? (
            <a className={styles.orderLink} href={`/admin/shop/orders/${job.orderId}`}>
              {job.orderNumber}
            </a>
          ) : (
            <span className={styles.positionTitle}>{job.placementLabel}</span>
          )}
          <span className={styles.jobDate}>
            {showOrder ? new Date(job.orderedAt).toLocaleDateString() : `hoop ${mm(job.fieldWidthMm)} × ${mm(job.fieldHeightMm)}`}
          </span>
        </div>
        <span className={`${styles.statusBadge} ${styles[`status_${job.productionStatus}`]}`}>{STATUS_LABEL[job.productionStatus]}</span>
      </header>

      {!workable && (
        <p className={styles.holdNote} role="status">
          Order is <strong>{job.orderStatus.replace(/_/g, " ")}</strong> — do not produce this job until it is paid.
        </p>
      )}

      {/* The whole reason the operator is on this screen: every box, its
          words set large, its face, its size, its spool, and where it sits.
          Set in a face of ours rather than the customer's — the font is
          named beside it, so nobody mistakes the preview for the stitch file. */}
      <ol className={styles.boxes}>
        {(job.elements?.length ? job.elements : []).map((el, i) => {
          const isMotifBox = el.contentType === "motif";
          const finish = [
            el.fontWeight !== 400 ? WEIGHT_NAME[el.fontWeight] ?? String(el.fontWeight) : null,
            el.lineCount > 1 ? `${el.lineCount} lines` : null,
            el.curveDeg ? `curve ${el.curveDeg > 0 ? "+" : ""}${el.curveDeg}°` : null,
            el.isPuff ? "3D puff" : null,
          ].filter(Boolean);
          const placed = [
            Math.abs(el.offsetXMm) >= 0.05 || Math.abs(el.offsetYMm) >= 0.05
              ? `at ${el.offsetXMm > 0 ? "+" : ""}${el.offsetXMm.toFixed(1)} / ${el.offsetYMm > 0 ? "+" : ""}${el.offsetYMm.toFixed(1)} mm`
              : "centred",
            el.rotationDeg ? `${el.rotationDeg}°` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={i} className={styles.boxItem}>
              <span className={styles.boxIndex}>{i + 1}</span>
              <div className={styles.boxBody}>
                <strong className={`${styles.stitchTextValue} ${isMotifBox ? styles.stitchTextMotif : ""}`}>{isMotifBox ? (el.motifName ?? "shape") : el.text}</strong>
                <span className={styles.thread} title={el.thread.name}>
                  <span className={styles.threadChip} style={{ background: el.thread.hex }} aria-hidden="true" />
                  <span className={styles.threadCode}>
                    {el.thread.brand} {el.thread.code}
                  </span>
                  <span className={styles.threadName}>{el.thread.name}</span>
                </span>
                <span className={styles.boxSpecs}>
                  {isMotifBox ? mm(el.motifSizeMm ?? 0) : `${el.fontName} · ${mm(el.heightMm)}`}
                  {finish.length > 0 && ` · ${finish.join(" · ")}`}
                  {` · ${placed}`}
                  {` · ≈ ${el.stitchEstimate.toLocaleString()} st.`}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <dl className={styles.jobSpecs}>
        <div>
          <dt>Item</dt>
          <dd>
            {job.quantity} × {job.productTitle}
            {job.options.length > 0 && <span className={styles.specSub}>{job.options.map((o) => `${o.attributeName}: ${o.displayValue ?? o.value}`).join(" · ")}</span>}
            {job.sku && <span className={ui.codeChip}>{job.sku}</span>}
          </dd>
        </div>
        {showOrder && job.customerName && (
          <div>
            <dt>Customer</dt>
            <dd>{job.customerName}</dd>
          </div>
        )}
        <div>
          <dt>Area</dt>
          <dd className={moved ? styles.specWarn : undefined}>
            {mm(job.fieldWidthMm)} × {mm(job.fieldHeightMm)} · {placement}
          </dd>
        </div>
        <div>
          <dt>Stitches</dt>
          <dd>
            ≈ {(job.stitchEstimate * job.quantity).toLocaleString()}
            {job.quantity > 1 && <span className={ui.muted}> ({job.stitchEstimate.toLocaleString()} each)</span>}
          </dd>
        </div>
        <div>
          <dt>Charged</dt>
          <dd>{eur(job.priceCents * job.quantity)}</dd>
        </div>
      </dl>

      {/* The digitiser's two fields. Saved on their own rather than with the
          status: a stitch file usually arrives before the job is marked ready,
          and a note is worth writing at any stage. */}
      <div className={styles.jobFields}>
        <label className={styles.jobField}>
          <span className={styles.jobFieldLabel}>Stitch file</span>
          <span className={styles.jobFieldRow}>
            <input
              className={ui.input}
              value={fileKey}
              placeholder="e.g. ORD-1234-front.dst"
              onChange={(e) => setFileDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && fileDirty) void patch("file", { stitchFileKey: fileKey.trim() || null }, "Stitch file saved");
              }}
            />
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={!fileDirty || busy !== null}
              onClick={() => void patch("file", { stitchFileKey: fileKey.trim() || null }, "Stitch file saved")}
            >
              {busy === "file" ? <Loader2 size={14} className={styles.spin} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
              Save
            </button>
          </span>
          {job.digitizedAt && <span className={styles.jobFieldHint}>Digitised {new Date(job.digitizedAt).toLocaleString()}</span>}
        </label>
        <label className={styles.jobField}>
          <span className={styles.jobFieldLabel}>Production note</span>
          <textarea
            className={`${ui.textarea} ${styles.noteArea}`}
            value={note}
            rows={2}
            placeholder="Anything the person at the machine needs to know."
            onChange={(e) => setNoteDraft(e.target.value)}
          />
          {noteDirty && (
            <span className={styles.jobFieldRow}>
              <button type="button" className={styles.secondaryBtn} disabled={busy !== null} onClick={() => setNoteDraft(null)}>
                <RotateCcw size={14} aria-hidden="true" /> Discard
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busy !== null}
                onClick={() => void patch("note", { productionNote: note.trim() || null }, "Note saved")}
              >
                {busy === "note" ? <Loader2 size={14} className={styles.spin} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                Save note
              </button>
            </span>
          )}
        </label>
      </div>

      <footer className={styles.jobActions}>
        <div className={styles.jobActionsRow}>
          <button type="button" className={styles.secondaryBtn} onClick={() => setArtworkOpen(true)}>
            <FileDown size={14} aria-hidden="true" /> Artwork
          </button>
          <div className={styles.statusSelect}>
            <Select<ProductionStatus>
              ariaLabel="Production status"
              value={job.productionStatus}
              disabled={busy !== null}
              options={PRODUCTION_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              onChange={(s) => {
                if (s !== job.productionStatus) void patch("status", { productionStatus: s }, `Marked ${STATUS_LABEL[s].toLowerCase()}`);
              }}
            />
          </div>
        </div>
        {action && (
          <button
            type="button"
            className={`${styles.primaryBtn} ${styles.nextBtn}`}
            onClick={() => void patch("status", { productionStatus: action.next }, `Marked ${STATUS_LABEL[action.next].toLowerCase()}`)}
            disabled={busy !== null || !workable}
            title={workable ? undefined : "The order has not been paid."}
          >
            {busy === "status" ? <Loader2 size={14} className={styles.spin} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
            {action.label}
          </button>
        )}
      </footer>

      {artworkOpen && <ArtworkDialog job={job} onClose={() => setArtworkOpen(false)} />}
    </article>
  );
}

/**
 * The production artwork: the design as vector, at true millimetre scale,
 * inside its hoop field. Printed at actual size it is a placement template
 * the operator holds against the cap; downloaded, it is what the digitiser
 * opens.
 */
export function ArtworkDialog({ job, onClose }: { job: EmbroideryJob; onClose: () => void }) {
  const [svg, setSvg] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ productionSvg: string | null }>(`/next-api/admin/shop/personalization/queue/${job.id}/artwork`)
      .then((res) => !cancelled && setSvg(res.productionSvg))
      .catch(() => !cancelled && setSvg(null));
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fileStem = `${job.orderNumber}-${job.placementKey}`.replace(/[^\w.-]+/g, "_");

  const print = useCallback(() => {
    if (!svg) return;
    const w = window.open("", "_blank", "width=760,height=560");
    if (!w) return;
    w.document.write(
      `<!doctype html><title>${fileStem}</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}svg{max-width:96vw}@page{margin:10mm}</style>${svg}`,
    );
    w.document.close();
    w.focus();
    w.print();
  }, [svg, fileStem]);

  const download = useCallback(() => {
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileStem}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [svg, fileStem]);

  return (
    <div className={styles.artworkOverlay} role="dialog" aria-modal="true" aria-labelledby={`artwork-${job.id}`} onClick={onClose}>
      <div className={styles.artworkPanel} onClick={(e) => e.stopPropagation()}>
        <header className={styles.artworkHead}>
          <div>
            <h2 id={`artwork-${job.id}`}>Production artwork</h2>
            <p className={styles.artworkSub}>
              {job.orderNumber} · {job.placementLabel} · {job.elements.length} {job.elements.length === 1 ? "box" : "boxes"}
            </p>
          </div>
          <div className={styles.artworkActions}>
            <button type="button" className={styles.secondaryBtn} onClick={download} disabled={!svg}>
              <Download size={14} aria-hidden="true" /> SVG
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={print} disabled={!svg}>
              <Printer size={14} aria-hidden="true" /> Print actual size
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        {svg === undefined ? (
          <p className={ui.muted}>Loading artwork…</p>
        ) : svg ? (
          // The SVG is generated server-side from the stored design and never
          // from anything a customer typed into the page, so it is safe to
          // inline — and inlining is what lets it print to scale.
          <div className={styles.artworkStage} dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <p className={ui.error}>The artwork could not be rendered for this job. The saved design is intact — contact support with the order number.</p>
        )}
        <p className={styles.artworkNote}>
          The dashed rectangle is the hoop field for this position ({mm(job.fieldWidthMm)} × {mm(job.fieldHeightMm)}), drawn at true size.
        </p>
      </div>
    </div>
  );
}
