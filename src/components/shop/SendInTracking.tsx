"use client";

import { Printer } from "lucide-react";
import { getTranslations, toBcp47, type Locale } from "@/lib/i18n";
import styles from "./SendInTracking.module.css";

export interface SendInTrackingData {
  id: string;
  status: string;
  itemType: string;
  /** The item type's name in the customer's language. */
  itemLabel?: string;
  note: string | null;
  panelWidthMm: number;
  panelHeightMm: number;
  photos: { key: string; url: string }[];
  /** Their photo with the design on it, as they saw it. */
  mockupUrl?: string | null;
  /** Every side they photographed, each with the design drawn on it once rendered. */
  sides?: { placementKey: string; photoUrl: string; mockupUrl: string | null }[];
  returnCarrier: string | null;
  returnTrackingNumber: string | null;
  returnTrackingUrl: string | null;
  events: { id: string; status: string; note: string | null; photos: { key: string; url: string }[]; at: string }[];
  returnAddress: { name: string; line1: string; zip: string; city: string; country: string };
}

/** Every state a job passes through, in order. Exits (problem, cancelled) sit outside it. */
const LIFECYCLE = ["awaiting_item", "received", "in_production", "done", "returned", "delivered"] as const;

/**
 * The milestones the customer sees, and which lifecycle states each one stands
 * for.
 *
 * `in_production` and `done` are the workshop's own steps. They matter to the
 * desk, which still moves through them, but to someone waiting on their cap
 * they are two extra rows between "you have it" and "it is coming back" —
 * detail dressed as progress. Folding them into "Received" leaves four
 * milestones that each answer a different question: has it arrived, is it on
 * its way back, is it here.
 *
 * Nothing is lost by hiding them: a covered state's photographs and notes —
 * the finished piece above all — still render under the milestone that covers
 * it, in the order they happened.
 */
const RAIL = [
  { key: "awaiting_item", covers: ["awaiting_item"] },
  { key: "received", covers: ["received", "in_production", "done"] },
  { key: "returned", covers: ["returned"] },
  { key: "delivered", covers: ["delivered"] },
] as const satisfies ReadonlyArray<{ key: string; covers: readonly (typeof LIFECYCLE)[number][] }>;

interface Props {
  locale: Locale;
  orderNumber: string;
  sendIn: SendInTrackingData;
  /**
   * The boxes, for the send-in note: the words and their size in millimetres,
   * so the desk can hold a ruler against the item before anything is hooped.
   */
  designLines?: string[];
  /** A short form for the success page: address and note, without the history. */
  compact?: boolean;
}

/**
 * Where the customer's item is, and what the shop has shown them along the
 * way.
 *
 * Two things matter most to someone who has posted their own cap to a
 * stranger: that it arrived, and what it looks like now. So the shop's
 * photographs are the centre of this — each step carries its own — and the
 * first step carries the address and a printable note, because a parcel with
 * no order number in it is the one thing the desk cannot match.
 */
export default function SendInTracking({ locale, orderNumber, sendIn, designLines, compact = false }: Props) {
  const t = getTranslations(locale).sendIn;
  const bcp47 = toBcp47(locale);
  // Progress is measured on the full lifecycle, not on the visible rail: a job
  // in `in_production` has passed "Received" and must light it, even though
  // the rail has no row of its own for where it actually is.
  const lifeIdx = LIFECYCLE.indexOf(sendIn.status as (typeof LIFECYCLE)[number]);
  const exited = sendIn.status === "problem" || sendIn.status === "cancelled";
  const latestByStatus = new Map(sendIn.events.map((e) => [e.status, e]));
  const label = (s: string) => t.statuses[s as keyof typeof t.statuses] ?? s;
  const hint = (s: string) => t.statusHints[s as keyof typeof t.statusHints] ?? "";
  const sides = sendIn.sides ?? [];
  const sideName = (i: number) => t.sideN.replace("{n}", String(i + 1));

  /**
   * The send-in note: the order number, what is inside, and where it is
   * going, on one sheet the customer folds into the parcel. Printed from its
   * own window so the page's layout never has to be fought with print CSS.
   */
  const printSlip = () => {
    const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
    const a = sendIn.returnAddress;
    const rows: [string, string][] = [
      [t.slipOrder, `<span style="font-size:26px;font-weight:800;letter-spacing:.04em">${esc(orderNumber)}</span>`],
      [t.slipItem, esc(sendIn.itemLabel ?? sendIn.itemType) + (sides.length > 1 ? ` — ${esc(t.sideCount.replace("{n}", String(sides.length)))}` : "")],
      ...(designLines?.length ? ([[t.slipDesign, designLines.map(esc).join("<br>")]] as [string, string][]) : []),
      ...(sendIn.note ? ([[t.trackNote, esc(sendIn.note)]] as [string, string][]) : []),
      [t.trackSendTo, `${esc(a.name)}<br>${esc(a.line1)}<br>${esc(a.zip)} ${esc(a.city)}, ${esc(a.country)}`],
    ];
    const w = window.open("", "_blank", "width=720,height=640");
    if (!w) return;
    w.document.write(
      `<!doctype html><title>${esc(t.slipTitle)} — ${esc(orderNumber)}</title>` +
        `<style>body{font-family:system-ui,sans-serif;color:#000;margin:32px;max-width:640px}h1{font-size:22px;margin:0 0 4px}p{margin:0 0 18px;font-size:14px}table{border-collapse:collapse;width:100%;font-size:14px}th{text-align:left;padding:8px 10px 8px 0;width:30%;vertical-align:top;font-weight:600;color:#444;border-bottom:1px solid #ddd}td{padding:8px 0;border-bottom:1px solid #ddd;vertical-align:top;white-space:pre-line}@page{margin:16mm}</style>` +
        `<h1>${esc(t.slipTitle)}</h1><p>${esc(t.slipInstruction)}</p><table><tbody>` +
        rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join("") +
        `</tbody></table>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <section className={styles.card} aria-labelledby="sendin-title">
      <header className={styles.head}>
        <h3 id="sendin-title" className={styles.title}>
          {t.trackTitle}
        </h3>
        <span className={`${styles.status} ${styles[`status_${sendIn.status}`] ?? ""}`}>{label(sendIn.status)}</span>
      </header>

      <p className={styles.hint}>{hint(sendIn.status)}</p>

      {/* What they ordered, on their own item — one picture per side, to
          check against the parcel that comes back. */}
      {sides.length > 0 ? (
        <div className={styles.sides}>
          {sides.map((sd, i) => (
            <figure key={sd.placementKey} className={styles.side}>
              <a href={sd.mockupUrl ?? sd.photoUrl} target="_blank" rel="noopener noreferrer" className={styles.mockup}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sd.mockupUrl ?? sd.photoUrl} alt="" />
              </a>
              <figcaption className={styles.sideCaption}>{sideName(i)}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        sendIn.mockupUrl && (
          <a href={sendIn.mockupUrl} target="_blank" rel="noopener noreferrer" className={styles.mockup}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sendIn.mockupUrl} alt="" />
          </a>
        )
      )}

      {/* Where to post it — only while the shop is still waiting for it. */}
      {sendIn.status === "awaiting_item" && (
        <div className={styles.sendTo}>
          <div className={styles.sendToText}>
            <span className={styles.sendToLabel}>{t.trackSendTo}</span>
            <strong>{sendIn.returnAddress.name}</strong>
            <span>{sendIn.returnAddress.line1}</span>
            <span>
              {sendIn.returnAddress.zip} {sendIn.returnAddress.city}
            </span>
            <span>{sendIn.returnAddress.country}</span>
          </div>
          <button type="button" className={styles.printBtn} onClick={printSlip}>
            <Printer size={14} aria-hidden="true" /> {t.trackSlip}
          </button>
        </div>
      )}

      {sendIn.note && !compact && (
        <div className={styles.note}>
          <span className={styles.noteLabel}>{t.trackNote}</span>
          <p>{sendIn.note}</p>
        </div>
      )}

      {!compact && !exited && (
        <ol className={styles.rail}>
          {RAIL.map(({ key, covers }) => {
            const reached = lifeIdx >= LIFECYCLE.indexOf(covers[0]);
            // The milestone the job is standing on — the last one whose span
            // of lifecycle states contains where it actually is.
            // Widened deliberately: `as const` narrows each entry's `covers` to
            // its own literal tuple, so `includes` would only accept that
            // entry's members and reject the status union.
            const current = (covers as readonly string[]).includes(sendIn.status);
            // Every event this milestone covers, oldest first, so the arrival
            // photo is followed by the finished piece rather than replaced.
            const events = covers.map((c) => latestByStatus.get(c)).filter((e) => !!e);
            const entered = events[0];
            return (
              <li key={key} className={`${styles.step} ${reached ? styles.stepDone : ""} ${current ? styles.stepActive : ""}`}>
                <span className={styles.dot} aria-hidden="true" />
                <div className={styles.stepBody}>
                  <span className={styles.stepLabel}>{label(key)}</span>
                  {entered && (
                    <span className={styles.stepDate}>
                      {new Date(entered.at).toLocaleDateString(bcp47, { day: "numeric", month: "short" })} ·{" "}
                      {new Date(entered.at).toLocaleTimeString(bcp47, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {events.map((ev) => ev.note).filter(Boolean).map((note, i) => (
                    <p key={i} className={styles.stepNote}>
                      {note}
                    </p>
                  ))}
                  {events.flatMap((e) => e.photos).length > 0 && (
                    <div className={styles.photos}>
                      {events.flatMap((e) => e.photos).map((p) => (
                        <a key={p.key} href={p.url} target="_blank" rel="noopener noreferrer" className={styles.photo}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt="" loading="lazy" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* A problem or a cancellation: the latest word from the shop, and its photos. */}
      {!compact && exited && (
        <div className={styles.exit}>
          {sendIn.events
            .filter((e) => e.status === sendIn.status)
            .slice(-1)
            .map((e) => (
              <div key={e.id}>
                {e.note && <p className={styles.stepNote}>{e.note}</p>}
                {e.photos.length > 0 && (
                  <div className={styles.photos}>
                    {e.photos.map((p) => (
                      <a key={p.key} href={p.url} target="_blank" rel="noopener noreferrer" className={styles.photo}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {sendIn.returnTrackingNumber && (
        <div className={styles.returnTracking}>
          <span className={styles.noteLabel}>{t.trackReturnTracking}</span>
          <span>
            {sendIn.returnCarrier && `${sendIn.returnCarrier} · `}
            {sendIn.returnTrackingUrl ? (
              <a href={sendIn.returnTrackingUrl} target="_blank" rel="noopener noreferrer">
                {sendIn.returnTrackingNumber}
              </a>
            ) : (
              sendIn.returnTrackingNumber
            )}
          </span>
        </div>
      )}

    </section>
  );
}
