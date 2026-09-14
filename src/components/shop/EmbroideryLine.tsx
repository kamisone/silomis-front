import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n";
import styles from "./EmbroideryLine.module.css";

/** The customer-facing view of one design — what every order screen shows back. */
export interface EmbroideryLineDesign {
  placementKey: string;
  placementLabel: string;
  contentType: "text" | "monogram" | "motif";
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
    contentType: "text" | "monogram" | "motif";
    text: string;
    fontName: string;
    heightMm: number;
    isPuff?: boolean;
    motifName?: string | null;
    motifSizeMm?: number | null;
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
        const meta = [isMotif ? (b.motifSizeMm ? `${b.motifSizeMm}mm` : null) : `${b.fontName} · ${b.heightMm}mm`, b.thread.name ?? null, b.isPuff ? t.linePuff : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <span key={i} className={styles.box}>
            <span className={styles.chip} style={{ background: b.thread.hex }} title={b.thread.name} aria-hidden="true" />
            <span className={styles.subject}>{isMotif ? (b.motifName ?? t.contentTypes.motif) : `“${b.text}”`}</span>
            <span className={styles.meta}>{meta}</span>
          </span>
        );
      })}
    </span>
  );
}
