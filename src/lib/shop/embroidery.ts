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
  priceBands: EditorPriceBand[];
}

/**
 * Normalisation, kept identical to the server's so the character counter
 * counts what will actually be stitched. NFC first: an accented letter typed
 * as a base plus a combining mark is two code points, which would both
 * overrun the limit and reach the face as a glyph it does not have.
 */
export function normalizeText(raw: string, contentType: ContentType, uppercaseOnly: boolean): string {
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
  contentType: ContentType,
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
  text: string;
  heightMm: number;
  font: EditorFont;
  contentType: ContentType;
  colorCount: number;
  weightStep?: number;
}): number {
  const glyphs = [...args.text].filter((ch) => ch !== " ").length;
  const heightFactor = (args.heightMm / 10) ** 2;
  const typeFactor = args.contentType === "monogram" ? MONOGRAM_STITCH_FACTOR : 1;
  const perChar = args.font.stitchesPerCharAt10mm ?? 140;
  const weightFactor = weightForStep(args.weightStep).stitchFactor;

  const glyphStitches = glyphs * perChar * heightFactor * typeFactor * weightFactor;
  const colorStitches = Math.max(0, args.colorCount - 1) * STITCHES_PER_COLOR_CHANGE;
  return Math.ceil(glyphStitches + colorStitches + STITCH_BASE_OVERHEAD);
}

/** The first band the estimate fits in, or null when it is past the largest. */
export function resolveBand(stitches: number, bands: EditorPriceBand[]): EditorPriceBand | null {
  return [...bands].sort((a, b) => a.maxStitches - b.maxStitches).find((b) => stitches <= b.maxStitches) ?? null;
}

export type ValidationCode =
  | "empty"
  | "tooLong"
  | "unstitchable"
  | "monogramLength"
  | "tooWide"
  | "tooManyColors"
  | "tooManyStitches";

export interface EditorEvaluation {
  text: string;
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
 * and a wall of simultaneous complaints while someone is mid-word reads as
 * the form being broken.
 */
export function evaluate(args: {
  raw: string;
  contentType: ContentType;
  font: EditorFont;
  placement: EditorPlacement;
  heightMm: number;
  colorCount: number;
  bands: EditorPriceBand[];
  weightStep?: number;
}): EditorEvaluation {
  const { contentType, font, placement, heightMm, colorCount, bands, weightStep } = args;
  const text = normalizeText(args.raw, contentType, font.uppercaseOnly);
  const widthMm = estimateWidthMm(text, heightMm, font, contentType, weightStep);
  const stitches = estimateStitches({ text, heightMm, font, contentType, colorCount, weightStep });
  const band = resolveBand(stitches, bands);
  const widthFill = placement.fieldWidthMm > 0 ? Math.min(1, widthMm / placement.fieldWidthMm) : 0;

  const base = { text, stitches, widthMm, band, widthFill };
  const invalid = (error: ValidationCode): EditorEvaluation => ({ ...base, priceCents: null, error });

  if (!text) return invalid("empty");

  if (contentType === "monogram") {
    if (text.length < MONOGRAM_MIN_CHARS || text.length > MONOGRAM_MAX_CHARS) return invalid("monogramLength");
    if (!STITCHABLE_MONOGRAM.test(text)) return invalid("unstitchable");
  } else {
    if (text.length > placement.maxChars) return invalid("tooLong");
    if (!STITCHABLE_TEXT.test(text)) return invalid("unstitchable");
  }

  if (colorCount > placement.maxColors) return invalid("tooManyColors");
  if (widthMm > placement.fieldWidthMm) return invalid("tooWide");
  if (!band) return invalid("tooManyStitches");

  // Band covers machine time, the position covers the hooping and the run —
  // mirrors PersonalizationService.resolve.
  return { ...base, priceCents: band.priceCents + placement.priceCents, error: null };
}

/** Height bounds for a font in a placement — the tighter of the two. */
export function heightBounds(font: EditorFont, placement: EditorPlacement): { min: number; max: number } {
  return { min: font.minHeightMm, max: Math.min(font.maxHeightMm, placement.fieldHeightMm) };
}
