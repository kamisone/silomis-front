import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n";
import styles from "./EmbroideryLine.module.css";

/** The customer-facing view of one design — what every order screen shows back. */
export interface EmbroideryLineDesign {
  placementKey: string;
  placementLabel: string;
  contentType: "text" | "monogram" | "motif" | "artwork";
  text: string;
  motifName?: string | null;
  motifSizeMm?: number | null;
  fontName: string;
  heightMm: number;
  hasOutline?: boolean;
  isPuff?: boolean;
  threadColors: Array<{ hex: string; name?: string; code?: string }>;
  /** Every box in the area, each in its own spool. Absent on a legacy design. */
  elements?: Array<{
    contentType: "text" | "monogram" | "motif" | "artwork";
    text: string;
    fontName: string;
    heightMm: number;
    isPuff?: boolean;
    motifName?: string | null;
    motifSizeMm?: number | null;
    /** The customer's own logo, on a send-in. Either shape the server sends. */
    artwork?: { name: string; widthMm: number; heightMm: number } | null;
    artworkName?: string | null;
    artworkWidthMm?: number | null;
    artworkHeightMm?: number | null;
    thread: { hex: string; name?: string; code?: string };
  }>;
}

/**
 * One embroidered position under a basket or order line.
 *
 * Verbatim and never abbreviated: a personalised item cannot be returned, so
 * every place the customer sees their order — basket, checkout, confirmation,
 * tracking — has to show the exact spelling in the exact threads. One
 * component so those places cannot drift apart.
 */
export default function EmbroideryLine({ design, locale, compact = false }: { design: EmbroideryLineDesign; locale: Locale; compact?: boolean }) {
  const t = getTranslations(locale).personalize;

  // A design is one or more boxes. A legacy row is its own single box.
  const boxes = design.elements?.length
    ? design.elements
    : [
        {
          contentType: design.contentType,
          text: design.text,
          fontName: design.fontName,
          heightMm: design.heightMm,
          isPuff: design.isPuff,
          motifName: design.motifName,
          motifSizeMm: design.motifSizeMm,
          thread: design.threadColors[0] ?? { hex: "#000" },
        },
      ];

  return (
    <span className={`${styles.line} ${compact ? styles.compact : ""}`}>
      <span className={styles.position}>{design.placementLabel}</span>
      {boxes.map((b, i) => {
        const isMotif = b.contentType === "motif";
        const isArtwork = b.contentType === "artwork";
        const artName = b.artwork?.name ?? b.artworkName ?? null;
        const artW = b.artwork?.widthMm ?? b.artworkWidthMm ?? null;
        const artH = b.artwork?.heightMm ?? b.artworkHeightMm ?? null;
        const meta = [
          isArtwork
            ? artW && artH
              ? `${Math.round(artW)} × ${Math.round(artH)}mm`
              : null
            : isMotif
              ? b.motifSizeMm
                ? `${b.motifSizeMm}mm`
                : null
              : `${b.fontName} · ${b.heightMm}mm`,
          isArtwork ? null : (b.thread.name ?? null),
          b.isPuff ? t.linePuff : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <span key={i} className={styles.box}>
            {!isArtwork && <span className={styles.chip} style={{ background: b.thread.hex }} title={b.thread.name} aria-hidden="true" />}
            <span className={styles.subject}>{isArtwork ? (artName ?? t.contentTypes.artwork) : isMotif ? (b.motifName ?? t.contentTypes.motif) : `“${b.text}”`}</span>
            <span className={styles.meta}>{meta}</span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * One line per box for the send-in note — the words (or the logo's file
 * name), their size in millimetres and their spool — so the desk can hold a
 * ruler against the item before anything is hooped.
 */
export function slipLines(designs: EmbroideryLineDesign[]): string[] {
  return designs
    .flatMap((d) =>
      d.elements?.length
        ? d.elements.map((e) => {
            const artName = e.artwork?.name ?? e.artworkName ?? null;
            const artW = e.artwork?.widthMm ?? e.artworkWidthMm ?? null;
            const artH = e.artwork?.heightMm ?? e.artworkHeightMm ?? null;
            if (e.contentType === "artwork") return `${artName ?? "logo"} — ${artW && artH ? `${Math.round(artW)} × ${Math.round(artH)} mm` : ""}`;
            const size = e.contentType === "motif" ? `${e.motifSizeMm ?? ""} mm` : `${e.fontName} ${e.heightMm} mm`;
            return `${e.text || e.motifName || ""} — ${size}${e.thread.name ? ` · ${e.thread.name}` : ""}`;
          })
        : [`${d.text} — ${d.fontName} ${d.heightMm} mm`],
    )
    .filter((l) => !l.startsWith(" —"));
}
