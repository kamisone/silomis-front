/**
 * The editor's local copy of the stitch estimator.
 *
 * The backend is the authority: every design is re-validated and re-priced by
 * PersonalizationService before it reaches a cart, and the two must agree.
 * This copy exists so the price and the warnings move with the customer's
 * typing instead of a round trip behind every keystroke — it is a preview of
 * the server's answer, never a substitute for it.
 *
 * If you change a number here, change `back/src/personalization/` to match.
 * A drift shows up as a price that jumps when the debounced quote lands.
 */

/** Mirrors STITCHES_PER_COLOR_CHANGE — a trim, a tie-off and a re-tie. */
const STITCHES_PER_COLOR_CHANGE = 120;
/** Mirrors STITCH_BASE_OVERHEAD — underlay and travel, present in every job. */
const STITCH_BASE_OVERHEAD = 80;
/** Mirrors MONOGRAM_STITCH_FACTOR — interlocked letters, drawn denser. */
const MONOGRAM_STITCH_FACTOR = 1.45;
/** Mirrors the monogram width allowance in estimateWidthMm. */
const MONOGRAM_WIDTH_FACTOR = 1.25;

/**
 * Mirrors WEIGHT_SCALE. How heavy the lettering is stitched — not a second
 * digitised face, but the same outline laid down as a thicker or thinner satin
 * column, which is why it costs stitches and barely any width.
 */
export const WEIGHT_SCALE = [
  { step: 1, cssWeight: 300, stitchFactor: 0.82, widthFactor: 0.97 },
  { step: 2, cssWeight: 400, stitchFactor: 1.0, widthFactor: 1.0 },
  { step: 3, cssWeight: 500, stitchFactor: 1.18, widthFactor: 1.02 },
  { step: 4, cssWeight: 700, stitchFactor: 1.42, widthFactor: 1.05 },
  { step: 5, cssWeight: 900, stitchFactor: 1.72, widthFactor: 1.09 },
] as const;

export const DEFAULT_WEIGHT_STEP = 2;

export function weightForStep(step: number | undefined) {
  return WEIGHT_SCALE.find((w) => w.step === step) ?? WEIGHT_SCALE[DEFAULT_WEIGHT_STEP - 1];
}

/** Mirrors MAX_TRAVEL_FACTOR — how far the hoop may move from its traced spot. */
export const MAX_TRAVEL_FACTOR = 1.5;

// ── Design tools. Every constant here mirrors personalization.constants.ts;
//    the server re-derives all of it, this copy only keeps the figure moving
//    with the customer's typing.
export const MAX_TEXT_LINES = 3;
export const TRACKING_MIN = -0.12;
export const TRACKING_MAX = 0.5;
export const KERNING_LIMIT = 0.4;
export const CURVE_LIMIT_DEG = 160;
export const OUTLINE_STITCH_FACTOR = 0.55;
export const PUFF_STITCH_FACTOR = 1.35;
export const CURVE_STITCH_FACTOR = 1.08;
export const MOTIF_MIN_MM = 15;
export const MOTIF_MAX_MM = 120;
/** Lines cannot touch across rows; the sheet uses the same figure. */
export const LINE_LEADING = 1.35;

export type ContentKind = "text" | "monogram" | "motif";

export interface EditorMotif {
  key: string;
  name: string;
  path: string;
  viewBox: string;
  category: string | null;
}

export const MONOGRAM_MIN_CHARS = 2;
export const MONOGRAM_MAX_CHARS = 3;

export type ContentType = "text" | "monogram";

export interface EditorFont {
  key: string;
  name: string;
  webFamily: string;
  minHeightMm: number;
  maxHeightMm: number;
  avgCharWidthRatio: number;
  uppercaseOnly: boolean;
  supportsMonogram: boolean;
  supportsPuff: boolean;
  supportsCurve: boolean;
  /** Only the estimator uses it; the server holds the authoritative value. */
  stitchesPerCharAt10mm?: number;
}

export interface EditorPlacement {
  key: string;
  /** Already resolved into the shopper's language by the API. */
  label: string;
  hint: string | null;
  fieldWidthMm: number;
  fieldHeightMm: number;
  maxColors: number;
  maxChars: number;
  /** What this position costs, before the stitch-count band. */
  priceCents: number;
  /** Whether a frame here can take the height of foam. */
  allowPuff: boolean;
  /** The photograph this position is placed on. Every offered position has one. */
  imageUrl: string;
  /** The panel traced on that photo, or null while only the flat box exists. */
  corners: { x: number; y: number }[] | null;
  preview: { xPct: number; yPct: number; widthPct: number; heightPct: number; rotateDeg: number };
}

export interface EditorThread {
  id: string;
  brand: string;
  code: string;
  name: string;
  hex: string;
  /** matte | metallic | neon | glow — a slower thread costs more to run. */
  finish: string;
  priceMultiplier: number;
}

export interface EditorPriceBand {
  maxStitches: number;
  priceCents: number;
  label: string | null;
}

export interface EditorConfig {
  productId: string;
  template: { id: string; key: string; name: string; allowText: boolean; allowMonogram: boolean; allowUpload: boolean };
  /** Only positions this product actually has a photograph for. */
  placements: EditorPlacement[];
  fonts: EditorFont[];
  threads: EditorThread[];
  motifs: EditorMotif[];
  priceBands: EditorPriceBand[];
}

/**
 * Normalisation, kept identical to the server's so the character counter
 * counts what will actually be stitched. NFC first: an accented letter typed
 * as a base plus a combining mark is two code points, which would both
 * overrun the limit and reach the face as a glyph it does not have.
 */
export function normalizeText(raw: string, contentType: ContentKind, uppercaseOnly: boolean): string {
  let text = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (contentType === "monogram") text = text.replace(/\s/g, "").toUpperCase();
  else if (uppercaseOnly) text = text.toUpperCase();
  return text;
}

/** Over-estimates on purpose — see the note on the server's estimateWidthMm. */
export function estimateWidthMm(
  text: string,
  heightMm: number,
  font: EditorFont,
  contentType: ContentKind,
  weightStep = DEFAULT_WEIGHT_STEP,
): number {
  const advances = [...text].reduce((sum, ch) => sum + (ch === " " ? 0.5 : 1), 0);
  const base = advances * heightMm * font.avgCharWidthRatio * weightForStep(weightStep).widthFactor;
  return contentType === "monogram" ? base * MONOGRAM_WIDTH_FACTOR : base;
}

/**
 * Stitch count. Scales with the square of the height because a letter grows
 * in both directions at once — doubling a name's height roughly quadruples
 * the thread laid down, which is why the price climbs faster than the size.
 */
export function estimateStitches(args: {
  lines: string[];
  heightMm: number;
  font: EditorFont;
  contentType: ContentKind;
  colorCount: number;
  weightStep?: number;
  options: DesignOptions;
  /** Measured stitch count of the chosen motif at 30mm, when there is one. */
  motifStitchesAt30mm?: number;
}): number {
  const colorStitches = Math.max(0, args.colorCount - 1) * STITCHES_PER_COLOR_CHANGE;

  if (args.contentType === "motif") {
    // The catalogue's measured figure is not sent to the browser, so the local
    // estimate uses the seeded average. The debounced server quote replaces it
    // within a moment, and the difference is never more than a band edge.
    const per30 = args.motifStitchesAt30mm ?? 2200;
    const areaFactor = (args.options.motifSizeMm / 30) ** 2;
    return Math.ceil(per30 * areaFactor + colorStitches + STITCH_BASE_OVERHEAD);
  }

  const glyphs = args.lines.join("").split("").filter((ch) => ch !== " ").length;
  const heightFactor = (args.heightMm / 10) ** 2;
  const typeFactor = args.contentType === "monogram" ? MONOGRAM_STITCH_FACTOR : 1;
  const perChar = args.font.stitchesPerCharAt10mm ?? 140;
  const weightFactor = weightForStep(args.weightStep).stitchFactor;

  let glyphStitches = glyphs * perChar * heightFactor * typeFactor * weightFactor;
  if (args.options.curveDeg) glyphStitches *= CURVE_STITCH_FACTOR;
  if (args.options.puff) glyphStitches *= PUFF_STITCH_FACTOR;
  if (args.options.outline) glyphStitches *= 1 + OUTLINE_STITCH_FACTOR;

  return Math.ceil(glyphStitches + colorStitches + STITCH_BASE_OVERHEAD);
}

/** The first band the estimate fits in, or null when it is past the largest. */
export function resolveBand(stitches: number, bands: EditorPriceBand[]): EditorPriceBand | null {
  return [...bands].sort((a, b) => a.maxStitches - b.maxStitches).find((b) => stitches <= b.maxStitches) ?? null;
}

/**
 * Everything the customer chose for one position, as the editor holds it.
 * Mirrors PersonalizationInput minus the placement, which is the key it is
 * stored under.
 */
export interface DesignOptions {
  contentType: ContentKind;
  trackingPct: number;
  kerning: number[] | null;
  curveDeg: number;
  outline: boolean;
  puff: boolean;
  motifKey: string | null;
  motifSizeMm: number;
}

export const DEFAULT_OPTIONS: DesignOptions = {
  contentType: "text",
  trackingPct: 0,
  kerning: null,
  curveDeg: 0,
  outline: false,
  puff: false,
  motifKey: null,
  motifSizeMm: 30,
};

/** Splits and normalises, exactly as the server does. Blank lines are dropped. */
export function normalizeLines(raw: string, contentType: ContentKind, uppercaseOnly: boolean): string[] {
  if (contentType === "motif") return [];
  return raw
    .split(/\r?\n/)
    .map((line) => normalizeText(line, contentType === "monogram" ? "monogram" : "text", uppercaseOnly))
    .filter(Boolean);
}

/** Extra width the spacing controls add. Gaps, not glyphs — see the server. */
export function spacingWidthMm(longestLine: string, heightMm: number, trackingPct: number, kerning: number[] | null): number {
  const gaps = Math.max(0, longestLine.length - 1);
  const kernSum = kerning ? kerning.reduce((sum, k) => sum + k, 0) : 0;
  return (gaps * trackingPct + kernSum) * heightMm;
}

/**
 * How tall the whole design stands. The curve's rise is a function of the
 * CHORD, not the letter height — a long word bent 60° rises far more than a
 * short one at the same angle.
 */
export function stackHeightMm(args: {
  lineCount: number;
  heightMm: number;
  widthMm: number;
  curveDeg: number;
  contentType: ContentKind;
  motifSizeMm: number;
}): number {
  if (args.contentType === "motif") return args.motifSizeMm;
  const stack = Math.max(1, args.lineCount) * args.heightMm * (args.lineCount > 1 ? LINE_LEADING : 1);
  if (!args.curveDeg) return stack;
  const half = (Math.abs(args.curveDeg) * Math.PI) / 360;
  if (half <= 0) return stack;
  const radius = args.widthMm / (2 * Math.sin(half));
  return stack + (radius - radius * Math.cos(half));
}

export type ValidationCode =
  | "empty"
  | "tooLong"
  | "unstitchable"
  | "monogramLength"
  | "tooWide"
  | "tooTall"
  | "tooManyLines"
  | "tooManyColors"
  | "tooManyStitches"
  | "outlineNeedsSecondColor";

export interface EditorEvaluation {
  text: string;
  lines: string[];
  stitches: number;
  widthMm: number;
  /** null while the design is invalid — there is nothing to quote yet. */
  priceCents: number | null;
  band: EditorPriceBand | null;
  error: ValidationCode | null;
  /** How full the placement's width is, 0–1, for the fit meter. */
  widthFill: number;
}

/** Mirrors STITCHABLE_TEXT / STITCHABLE_MONOGRAM on the server. */
const STITCHABLE_TEXT = /^[A-Za-zÀ-ÖØ-öø-ÿŁłŃńŚśŹźŻżĄąĆćĘęÓó0-9 '&.\-]+$/u;
const STITCHABLE_MONOGRAM = /^[A-Za-zÀ-ÖØ-öø-ÿŁłŃńŚśŹźŻżĄąĆćĘęÓó]+$/u;

/**
 * One pass over a design: normalise, check, measure, price. Returns the first
 * problem rather than a list — the editor shows one thing to fix at a time,
 * and a wall of simultaneous complaints while someone is mid-word reads as the
 * form being broken.
 */
export function evaluate(args: {
  raw: string;
  font: EditorFont;
  placement: EditorPlacement;
  heightMm: number;
  colorCount: number;
  bands: EditorPriceBand[];
  weightStep?: number;
  options: DesignOptions;
  /** Highest multiplier among the chosen threads — a slower cone costs more. */
  threadMultiplier?: number;
}): EditorEvaluation {
  const { font, placement, heightMm, colorCount, bands, weightStep, options } = args;
  const { contentType } = options;

  const lines = normalizeLines(args.raw, contentType, font.uppercaseOnly);
  const text = lines.join("\n");
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");

  const widthMm =
    contentType === "motif"
      ? options.motifSizeMm
      : estimateWidthMm(text.replace(/\n/g, ""), heightMm, font, contentType, weightStep) / Math.max(1, lines.length) +
        spacingWidthMm(longest, heightMm, options.trackingPct, options.kerning);

  const stitches = estimateStitches({
    lines,
    heightMm,
    font,
    contentType,
    colorCount,
    weightStep,
    options,
  });
  const band = resolveBand(stitches, bands);
  const widthFill = placement.fieldWidthMm > 0 ? Math.min(1, widthMm / placement.fieldWidthMm) : 0;

  const base = { text, lines, stitches, widthMm, band, widthFill };
  const invalid = (error: ValidationCode): EditorEvaluation => ({ ...base, priceCents: null, error });

  if (contentType === "motif") {
    if (!options.motifKey) return invalid("empty");
  } else {
    if (!lines.length) return invalid("empty");
    if (lines.length > MAX_TEXT_LINES) return invalid("tooManyLines");

    for (const line of lines) {
      if (contentType === "monogram") {
        if (line.length < MONOGRAM_MIN_CHARS || line.length > MONOGRAM_MAX_CHARS) return invalid("monogramLength");
        if (!STITCHABLE_MONOGRAM.test(line)) return invalid("unstitchable");
      } else {
        if (line.length > placement.maxChars) return invalid("tooLong");
        if (!STITCHABLE_TEXT.test(line)) return invalid("unstitchable");
      }
    }
  }

  if (options.outline && colorCount < 2) return invalid("outlineNeedsSecondColor");
  if (colorCount > placement.maxColors) return invalid("tooManyColors");
  if (widthMm > placement.fieldWidthMm) return invalid("tooWide");

  const stackMm = stackHeightMm({
    lineCount: lines.length,
    heightMm,
    widthMm,
    curveDeg: options.curveDeg,
    contentType,
    motifSizeMm: options.motifSizeMm,
  });
  if (stackMm > placement.fieldHeightMm) return invalid("tooTall");

  if (!band) return invalid("tooManyStitches");

  // Band covers machine time, the position covers the hooping and the run, and
  // a slow thread multiplies the first — mirrors PersonalizationService.resolve.
  const priceCents = Math.round(band.priceCents * (args.threadMultiplier ?? 1)) + placement.priceCents;
  return { ...base, priceCents, error: null };
}

/** Height bounds for a font in a placement — the tighter of the two. */
export function heightBounds(font: EditorFont, placement: EditorPlacement): { min: number; max: number } {
  return { min: font.minHeightMm, max: Math.min(font.maxHeightMm, placement.fieldHeightMm) };
}
