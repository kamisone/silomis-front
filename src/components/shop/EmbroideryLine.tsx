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
  const isMotif = design.contentType === "motif";
  const meta = [
    design.placementLabel,
    isMotif ? (design.motifSizeMm ? `${design.motifSizeMm}mm` : null) : `${design.fontName} · ${design.heightMm}mm`,
    design.hasOutline ? t.lineOutline : null,
    design.isPuff ? t.linePuff : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span className={`${styles.line} ${compact ? styles.compact : ""}`}>
      <span className={styles.chips} aria-hidden="true">
        {design.threadColors.map((th, i) => (
          <span key={`${th.hex}-${i}`} className={styles.chip} style={{ background: th.hex }} title={th.name} />
        ))}
      </span>
      <span className={styles.subject}>{isMotif ? (design.motifName ?? t.contentTypes.motif) : `“${design.text}”`}</span>
      <span className={styles.meta}>{meta}</span>
    </span>
  );
}
