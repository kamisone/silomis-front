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
/**
 * Mirrors STITCH_HEIGHT_EXPONENT — a satin column widens with the letter rather
 * than adding stitches, so the count grows well short of the square.
 */
const STITCH_HEIGHT_EXPONENT = 1.3;
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
export const PUFF_STITCH_FACTOR = 1.35;
export const CURVE_STITCH_FACTOR = 1.08;
export const MOTIF_MIN_MM = 15;
export const MOTIF_MAX_MM = 120;
/** Lines cannot touch across rows; the sheet uses the same figure. */
export const LINE_LEADING = 1.35;
/**
 * Mirrors FIELD_MIN_MM / FIELD_MAX_*_MM — the machine's largest frame. The
 * config carries the server's own figures; these are the fallback while it
 * loads.
 */
export const FIELD_MIN_MM = 15;
export const FIELD_MAX_WIDTH_MM = 300;
export const FIELD_MAX_HEIGHT_MM = 200;
/** Mirrors HOOP_MARGIN_MM — clearance a frame needs round the stitching, each side. */
export const HOOP_MARGIN_MM = 4;

export interface FieldLimits {
  minMm: number;
  maxWidthMm: number;
  maxHeightMm: number;
}

export const DEFAULT_FIELD_LIMITS: FieldLimits = { minMm: FIELD_MIN_MM, maxWidthMm: FIELD_MAX_WIDTH_MM, maxHeightMm: FIELD_MAX_HEIGHT_MM };

/**
 * Mirrors hoopAround on the server: the smallest rectangle, square to the
 * garment, that holds every box with its clearance — measured on each box's
 * real footprint, turned as it is.
 */
export function hoopAround(
  elements: { offset: { x: number; y: number }; rotationDeg: number; widthMm: number; stackMm: number; heightMm: number }[],
): { widthMm: number; heightMm: number; cx: number; cy: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    const rad = (el.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const bw = Math.max(el.widthMm, 1) / 2;
    const bh = Math.max(el.stackMm, el.heightMm, 1) / 2;
    for (const [x, y] of [
      [-bw, -bh],
      [bw, -bh],
      [bw, bh],
      [-bw, bh],
    ]) {
      const px = el.offset.x + x * cos - y * sin;
      const py = el.offset.y + x * sin + y * cos;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
  }
  if (!elements.length) return { widthMm: FIELD_MIN_MM, heightMm: FIELD_MIN_MM, cx: 0, cy: 0 };
  return {
    widthMm: Math.max(FIELD_MIN_MM, maxX - minX + 2 * HOOP_MARGIN_MM),
    heightMm: Math.max(FIELD_MIN_MM, maxY - minY + 2 * HOOP_MARGIN_MM),
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

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
  /**
   * The real size of the traced panel — what puts millimetres onto the
   * photograph at scale, and what bounds how far a box may travel over it.
   */
  fieldWidthMm: number;
  fieldHeightMm: number;
  maxColors: number;
  maxChars: number;
  /** What this position costs, before the stitch-count band. */
  priceCents: number;
  /** Whether a frame here can take the height of foam. */
  allowPuff: boolean;
  /** The photograph this position is placed on. Null only for a send-in position, whose photo the customer brings. */
  imageUrl: string | null;
  /** The photo is the customer's — the editor is given it rather than shown one. */
  usesCustomerPhoto?: boolean;
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
  /** The machine's largest frame — what every box, and the hoop round them, must fit. */
  fieldLimits?: FieldLimits;
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
  const heightFactor = (args.heightMm / 10) ** STITCH_HEIGHT_EXPONENT;
  const typeFactor = args.contentType === "monogram" ? MONOGRAM_STITCH_FACTOR : 1;
  const perChar = args.font.stitchesPerCharAt10mm ?? 140;
  const weightFactor = weightForStep(args.weightStep).stitchFactor;

  let glyphStitches = glyphs * perChar * heightFactor * typeFactor * weightFactor;
  if (args.options.curveDeg) glyphStitches *= CURVE_STITCH_FACTOR;
  if (args.options.puff) glyphStitches *= PUFF_STITCH_FACTOR;

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
  puff: boolean;
  motifKey: string | null;
  motifSizeMm: number;
}

export const DEFAULT_OPTIONS: DesignOptions = {
  contentType: "text",
  trackingPct: 0,
  kerning: null,
  curveDeg: 0,
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

/**
 * What one line will measure once stitched, in millimetres.
 *
 * This is the number the validator judges by, and the number the preview is
 * rendered at — see the note in DesignPreview. It is a model of the digitised
 * embroidery face, not of whatever the browser happens to have installed.
 */
export function lineWidthMm(args: {
  line: string;
  heightMm: number;
  font: EditorFont;
  contentType: ContentKind;
  weightStep?: number;
  trackingPct: number;
  kerning: number[] | null;
}): number {
  const base = estimateWidthMm(args.line, args.heightMm, args.font, args.contentType, args.weightStep);
  return base + spacingWidthMm(args.line, args.heightMm, args.trackingPct, args.kerning);
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
  | "tooManyBoxes";

/** One box, measured. */
export interface ElementEvaluation {
  text: string;
  lines: string[];
  stitches: number;
  widthMm: number;
  /** Every line stacked, curve included — what has to fit the area's height. */
  stackMm: number;
  /** How full the area's width is, 0–1, for the fit meter. */
  widthFill: number;
  error: ValidationCode | null;
}

/** The position: every box, and the whole hoop priced as one run. */
export interface EditorEvaluation {
  elements: ElementEvaluation[];
  /** Every box's words, in order — what the review step spells out. */
  text: string;
  stitches: number;
  /** null while the design is invalid — there is nothing to quote yet. */
  priceCents: number | null;
  band: EditorPriceBand | null;
  error: ValidationCode | null;
  /** Which box the error is on, or null for a position-level one. */
  errorElement: number | null;
  /** Distinct spools across the boxes — the machine's needles. */
  threadCount: number;
  /** The hoop fitted round the boxes, as the server will fit it. */
  hoop: { widthMm: number; heightMm: number; cx: number; cy: number };
}

/** Mirrors STITCHABLE_TEXT / STITCHABLE_MONOGRAM on the server. */
const STITCHABLE_TEXT = /^[A-Za-zÀ-ÖØ-öø-ÿŁłŃńŚśŹźŻżĄąĆćĘęÓó0-9 '&.\-]+$/u;
const STITCHABLE_MONOGRAM = /^[A-Za-zÀ-ÖØ-öø-ÿŁłŃńŚśŹźŻżĄąĆćĘęÓó]+$/u;

/** Mirrors MAX_ELEMENTS on the server. */
export const MAX_ELEMENTS = 6;

/**
 * One pass over a box: normalise, check, measure. Returns the first problem
 * rather than a list — the editor shows one thing to fix at a time, and a
 * wall of simultaneous complaints while someone is mid-word reads as the form
 * being broken.
 */
export function evaluateElement(args: {
  raw: string;
  font: EditorFont;
  placement: EditorPlacement;
  limits: FieldLimits;
  heightMm: number;
  weightStep?: number;
  options: DesignOptions;
}): ElementEvaluation {
  const { font, placement, limits, heightMm, weightStep, options } = args;
  const { contentType } = options;

  const lines = normalizeLines(args.raw, contentType, font.uppercaseOnly);
  const text = lines.join("\n");
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");

  // The widest line is what has to fit; measuring the joined text and dividing
  // by the line count was an average, and an average passes a design whose
  // long line overruns because its short one does not.
  const widthMm =
    contentType === "motif"
      ? options.motifSizeMm
      : lineWidthMm({
          line: longest,
          heightMm,
          font,
          contentType,
          weightStep,
          trackingPct: options.trackingPct,
          kerning: options.kerning,
        });

  // A box is one spool, so it carries no colour change of its own; those are
  // counted once for the position, between one box's spool and the next.
  const stitches = estimateStitches({ lines, heightMm, font, contentType, colorCount: 1, weightStep, options });
  const widthFill = placement.fieldWidthMm > 0 ? Math.min(1, widthMm / placement.fieldWidthMm) : 0;
  const stackMm = stackHeightMm({
    lineCount: lines.length,
    heightMm,
    widthMm,
    curveDeg: options.curveDeg,
    contentType,
    motifSizeMm: options.motifSizeMm,
  });

  const base = { text, lines, stitches, widthMm, stackMm, widthFill };
  const invalid = (error: ValidationCode): ElementEvaluation => ({ ...base, error });

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

  // A single box has to fit the machine's largest frame on its own; the
  // whole position is checked again once every box is placed.
  if (widthMm > limits.maxWidthMm) return invalid("tooWide");
  if (stackMm > limits.maxHeightMm) return invalid("tooTall");

  return { ...base, error: null };
}

/**
 * The position as a whole: every box checked, then one hoop priced as one
 * run — the stitches summed, a colour change per extra spool, the band on the
 * total, the position's own price once. Mirrors PersonalizationService.resolve.
 */
export function evaluateDesign(args: {
  elements: {
    raw: string;
    font: EditorFont;
    heightMm: number;
    weightStep?: number;
    options: DesignOptions;
    thread: EditorThread | undefined;
    offset: { x: number; y: number };
    rotationDeg: number;
  }[];
  placement: EditorPlacement;
  limits: FieldLimits;
  bands: EditorPriceBand[];
}): EditorEvaluation {
  const { placement, limits, bands } = args;
  const elements = args.elements.map((el) =>
    evaluateElement({ raw: el.raw, font: el.font, placement, limits, heightMm: el.heightMm, weightStep: el.weightStep, options: el.options }),
  );
  const hoop = hoopAround(
    args.elements.map((el, i) => ({ offset: el.offset, rotationDeg: el.rotationDeg, widthMm: elements[i].widthMm, stackMm: elements[i].stackMm, heightMm: el.heightMm })),
  );
  const threads = new Map<string, EditorThread>();
  for (const el of args.elements) if (el.thread) threads.set(el.thread.id, el.thread);
  const threadCount = threads.size;

  const stitches = elements.reduce((sum, el) => sum + el.stitches, 0) + Math.max(0, threadCount - 1) * STITCHES_PER_COLOR_CHANGE;
  const band = resolveBand(stitches, bands);
  const text = elements.map((el) => el.text).filter(Boolean).join("\n");
  const base = { elements, text, stitches, band, threadCount, hoop };
  const invalid = (error: ValidationCode, errorElement: number | null = null): EditorEvaluation => ({
    ...base,
    priceCents: null,
    error,
    errorElement,
  });

  if (!elements.length || elements.length > MAX_ELEMENTS) return invalid("tooManyBoxes");
  const broken = elements.findIndex((el) => el.error);
  if (broken >= 0) return invalid(elements[broken].error!, broken);
  if (threadCount > placement.maxColors) return invalid("tooManyColors");
  // Boxes far apart need a hoop the machine does not have, however small each is.
  if (hoop.widthMm > limits.maxWidthMm) return invalid("tooWide");
  if (hoop.heightMm > limits.maxHeightMm) return invalid("tooTall");
  if (!band) return invalid("tooManyStitches");

  // A customer's own item is a flat fee per side — the position's price is the
  // item type's, and the design never moves it. Mirrors the server, which
  // still refuses a design past the largest band (checked above) but charges
  // only the side.
  if (placement.usesCustomerPhoto) return { ...base, priceCents: placement.priceCents, error: null, errorElement: null };

  // Band covers machine time, the position covers the hooping and the run, and
  // a slow thread multiplies the first — the dearest spool on the hoop decides.
  const multiplier = Math.max(1, ...[...threads.values()].map((t) => t.priceMultiplier ?? 1));
  const priceCents = Math.round(band.priceCents * multiplier) + placement.priceCents;
  return { ...base, priceCents, error: null, errorElement: null };
}

/** Height bounds for a font. */
export function heightBounds(font: EditorFont): { min: number; max: number } {
  return { min: font.minHeightMm, max: font.maxHeightMm };
}
