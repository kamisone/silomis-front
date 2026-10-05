/**
 * The editor's local copy of the server's measuring and pricing.
 *
 * The backend is the authority: every design is re-validated and re-priced by
 * PersonalizationService before it reaches a cart, and the two must agree. This
 * copy exists so the price and the warnings move with the customer's typing
 * instead of a round trip behind every keystroke — it is a preview of the
 * server's answer, never a substitute for it.
 *
 * If you change a number here, change `back/src/personalization/` to match. A
 * drift shows up as a price that jumps when the debounced quote lands.
 *
 * It used to mirror a stitch estimator too, which is gone: only a digitised file
 * has a stitch count, and pricing off a parametric guess put the guess's whole
 * error on the invoice. What is left mirrors geometry — how wide the lettering
 * comes out, how tall it stands, whether it fits the hoop — and adds up figures
 * the shop typed.
 */

/** Mirrors the monogram width allowance in estimateWidthMm. */
const MONOGRAM_WIDTH_FACTOR = 1.25;

/**
 * Mirrors WEIGHT_SCALE. How heavy the lettering is stitched — not a second
 * digitised face, but the same outline laid down as a thicker or thinner satin
 * column, which is why it barely changes the width.
 */
export const WEIGHT_SCALE = [
  { step: 1, cssWeight: 300, widthFactor: 0.97 },
  { step: 2, cssWeight: 400, widthFactor: 1.0 },
  { step: 3, cssWeight: 500, widthFactor: 1.02 },
  { step: 4, cssWeight: 700, widthFactor: 1.05 },
  { step: 5, cssWeight: 900, widthFactor: 1.09 },
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
/**
 * How far a line may be bent, each way. A full circle: at 360° the text closes
 * on itself, which is the shape a crest or a cap-back name actually wants.
 *
 * It could not go past 180° before, and not for a UI reason — the geometry would
 * not express it. See `curveArc`.
 */
export const CURVE_LIMIT_DEG = 360;

/**
 * The circle a curved line of lettering rides.
 *
 * Measured along the ARC, not across the chord. The chord was the wrong
 * invariant and it capped the feature at 180°: `radius = chord / (2·sin(θ/2))`
 * is not one-to-one past a semicircle — 270° comes out with the same radius as
 * 90° — and at 360° `sin(180°)` is zero, so the radius is infinite and the shape
 * does not exist. Arc length behaves everywhere: `radius = L / θ` falls away
 * smoothly, the chord closes to nothing at 360°, and the sagitta stays finite.
 * It is also the honest invariant for embroidery: what is fixed when you bend a
 * word is the length of thread in it.
 *
 * `crownDy` and `endDy` straddle the line's own baseline by half a sagitta each.
 * They used to push the ends down by the WHOLE sagitta, leaving the curve
 * hanging below the box the validator had measured for it — by 12.6mm at 160° on
 * a 60mm line — so the bottom of a strongly curved word fell outside its layer
 * and was clipped away. That is the letters that went missing as the angle moved.
 *
 * The 1% of slack on the radius is deliberate: the longest line's `textLength`
 * equals the arc length exactly, and SVG drops glyphs that run past the end of a
 * `textPath`, so the path is made a hair longer than the text it carries.
 */
export function curveArc(lengthMm: number, curveDeg: number) {
  const theta = (Math.abs(curveDeg) * Math.PI) / 180;
  const radius = (Math.max(1, lengthMm) * 1.01) / theta;
  const halfTheta = theta / 2;
  const sagitta = radius * (1 - Math.cos(halfTheta));
  const up = curveDeg > 0;
  return {
    theta,
    radius,
    sagitta,
    /** Half the straight distance between the two ends — zero at a full circle. */
    halfChord: radius * Math.sin(halfTheta),
    crownDy: up ? -sagitta / 2 : sagitta / 2,
    endDy: up ? sagitta / 2 : -sagitta / 2,
    /** SVG's sweep flag: clockwise on screen for a crown that rises. */
    sweep: up ? 1 : 0,
  };
}
/**
 * A rail on the text field, not a limit on the design: it stops a pathological
 * paste, and matches the DTO's own `z.string().max(200)`. What a position
 * actually holds is decided by measuring the design and fitting a hoop round
 * it — a character count could only ever disagree with that.
 */
export const MAX_TEXT_CHARS = 200;

/**
 * The letter height a new box starts at, in millimetres.
 *
 * It used to be a third of the position's own `fieldHeightMm`, which read well
 * while that was a real measurement an admin kept current. It is not one any
 * more — the panel is a constant and the tracing carries the meaning — so
 * deriving from it only reproduced whatever number happened to be in the row,
 * and two positions on the same cap opened their placeholder at wildly
 * different sizes. One number, the same on every position.
 */
export const DEFAULT_TEXT_HEIGHT_MM = 17;

/** The width a design opens at before the customer sizes it themselves. */
export const MOTIF_START_MM = 30;

/**
 * The widths the slider offers for a design of this shape.
 *
 * There is no band a design has to sit in any more: the machine's limit is what
 * fits the position's embroidery field, which `evaluate` checks in millimetres
 * on both sides. So this is only the travel of a control — wide enough to reach
 * anything the field allows, and it stops where the field does rather than at a
 * figure of its own. The height follows the drawing's proportion, so a wide
 * design runs out of field at a smaller width than a square one.
 */
export function motifWidthBounds(aspect: number, maxWidthMm: number, maxHeightMm: number): { min: number; max: number } {
  const a = aspect > 0 ? aspect : 1;
  return { min: 1, max: Math.max(1, Math.round(Math.min(maxWidthMm, maxHeightMm / a))) };
}

/** The width a design opens at: the usual 30mm, or the widest the field allows. */
export function startingMotifWidthMm(aspect: number, maxWidthMm: number, maxHeightMm: number): number {
  const { min, max } = motifWidthBounds(aspect, maxWidthMm, maxHeightMm);
  return Math.round(Math.min(Math.max(MOTIF_START_MM, min), max));
}
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
 * How big a box may be on a position. A catalogue position is bounded by the
 * largest hoop; the customer's own item by their photograph — the panel's
 * real size scaled up by the share of the picture it covers, exactly as the
 * server works it out. On their own item they decide.
 */
export function limitsFor(placement: { usesCustomerPhoto?: boolean; corners: { x: number; y: number }[] | null; fieldWidthMm: number; fieldHeightMm: number }, base: FieldLimits): FieldLimits {
  if (!placement.usesCustomerPhoto || !placement.corners?.length) return base;
  const xs = placement.corners.map((c) => c.x);
  const ys = placement.corners.map((c) => c.y);
  const wShare = Math.max(1, Math.max(...xs) - Math.min(...xs)) / 100;
  const hShare = Math.max(1, Math.max(...ys) - Math.min(...ys)) / 100;
  return { ...base, maxWidthMm: Math.round(placement.fieldWidthMm / wShare), maxHeightMm: Math.round(placement.fieldHeightMm / hShare) };
}

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

export type ContentKind = "text" | "monogram" | "motif" | "artwork";

/** Mirrors SEND_IN_ARTWORK_* on the server: the smallest a customer's logo may be stitched (the largest is the photograph), and the fill density of the estimate. */
export const ARTWORK_MIN_MM = 10;
export const ARTWORK_STITCHES_PER_MM2 = 6;

export interface EditorMotif {
  key: string;
  name: string;
  path: string;
  viewBox: string;
  /**
   * The design's shapes, in drawing order. `transform` is set when the uploaded
   * artwork placed the shape with one — it goes straight onto the `<path>`, the
   * same as the server's own rendering. Null for the older seeded designs,
   * which are `path` and nothing else.
   */
  paths?: { d: string; fill: string; transform?: string }[] | null;
  /**
   * Sewn in the fills `paths` carries, rather than in a spool the customer
   * picks. Not the same question as "does it have shapes": a one-colour design
   * has shapes too, and they all get stitched in the chosen thread.
   */
  ownColours?: boolean;
  /** The key of the tab it sits under, or null for one that only shows under "All". */
  category: string | null;
  /**
   * What picking this design adds to the embroidery price, in cents, on top of
   * the position's own price. Charged per box, because each box is stitched.
   */
  priceCents?: number;
}

/** One tab in the design library, named by the server in the customer's language. */
export interface EditorMotifCategory {
  key: string;
  name: string;
}

export const MONOGRAM_MIN_CHARS = 2;
export const MONOGRAM_MAX_CHARS = 3;

export type ContentType = "text" | "monogram";

export interface EditorFont {
  key: string;
  name: string;
  webFamily: string;
  /** A stylesheet to load so the face is the same on every device; null for a system face. */
  webFontCss?: string | null;
  avgCharWidthRatio: number;
  uppercaseOnly: boolean;
  supportsMonogram: boolean;
  supportsPuff: boolean;
  supportsCurve: boolean;
  /** Only the estimator uses it; the server holds the authoritative value. */
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
  /** What this position costs — the hooping and the run, once per position. */
  priceCents: number;
  /** The photograph this position is placed on. Null only for a send-in position, whose photo the customer brings. */
  imageUrl: string | null;
  /** The photo is the customer's — the editor is given it rather than shown one. */
  usesCustomerPhoto?: boolean;
  /** The panel traced on that photo, or null while only the flat box exists. */
  corners: { x: number; y: number }[] | null;
  /** Where the embroidery area sits on this position's photo, as a share of it. */
  preview: { xPct: number; yPct: number; widthPct: number; heightPct: number };
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

export interface EditorConfig {
  productId: string;
  /** Which editors the product offers — "Just add my text" (simple), "Design it myself" (advanced). Absent on an older backend: both. */
  modes?: { simple: boolean; advanced: boolean };
  template: { id: string; key: string; name: string; allowText: boolean; allowMonogram: boolean; allowUpload: boolean };
  /** Only positions this product actually has a photograph for. */
  placements: EditorPlacement[];
  fonts: EditorFont[];
  threads: EditorThread[];
  motifs: EditorMotif[];
  /**
   * The library's tabs, in the shop's order. Admin data, so the labels arrive
   * translated rather than being looked up against a compiled-in list.
   */
  motifCategories?: EditorMotifCategory[];
  /** The machine's largest frame — what every box, and the hoop round them, must fit. */
  fieldLimits?: FieldLimits;
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
  // Combining marks (Arabic harakat, Devanagari matras, decomposed accents) sit
  // on the letter before them and advance nothing — see the server's estimator.
  const advances = [...text].reduce((sum, ch) => sum + (ch === " " ? 0.5 : COMBINING_MARK.test(ch) ? 0 : 1), 0);
  const base = advances * heightMm * font.avgCharWidthRatio * weightForStep(weightStep).widthFactor;
  return contentType === "monogram" ? base * MONOGRAM_WIDTH_FACTOR : base;
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
  /** A satin border round the letters, in millimetres — thickness past the heaviest weight. Send-in only. */
  borderMm: number;
  /** Line spacing as a multiple of the letter height. */
  leading: number;
  motifKey: string | null;
  /** The shape's width. */
  motifSizeMm: number;
  /** The shape's height — null means the drawing's own proportion. */
  motifHeightMm: number | null;
  /** Height ÷ width of the chosen shape's drawing, kept so the proportion is known without the catalogue. */
  motifAspect: number;
  /**
   * The customer's own logo, on a send-in: the upload's key and signed URL,
   * its file name, height ÷ width, drawn share, and how wide it is stitched.
   */
  artworkKey: string | null;
  artworkUrl: string | null;
  artworkName: string | null;
  artworkAspect: number;
  artworkCoverage: number;
  artworkSizeMm: number;
  /** The logo's height — null means the file's own proportion. */
  artworkHeightMm: number | null;
}

export const DEFAULT_OPTIONS: DesignOptions = {
  contentType: "text",
  trackingPct: 0,
  kerning: null,
  curveDeg: 0,
  puff: false,
  borderMm: 0,
  leading: LINE_LEADING,
  motifKey: null,
  motifSizeMm: 30,
  motifHeightMm: null,
  motifAspect: 1,
  artworkKey: null,
  artworkUrl: null,
  artworkName: null,
  artworkAspect: 1,
  artworkCoverage: 0.5,
  artworkSizeMm: 60,
  artworkHeightMm: null,
};

/** The box a shape or a logo occupies, width and height, from its options. */
export function pictureSizeMm(options: DesignOptions): { widthMm: number; heightMm: number } {
  if (options.contentType === "artwork") {
    const widthMm = options.artworkSizeMm;
    return { widthMm, heightMm: options.artworkHeightMm ?? widthMm * (options.artworkAspect || 1) };
  }
  const widthMm = options.motifSizeMm;
  return { widthMm, heightMm: options.motifHeightMm ?? widthMm * (options.motifAspect || 1) };
}

/** Splits and normalises, exactly as the server does. Blank lines are dropped. */
export function normalizeLines(raw: string, contentType: ContentKind, uppercaseOnly: boolean): string[] {
  if (contentType === "motif" || contentType === "artwork") return [];
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
  motifHeightMm?: number;
  artworkHeightMm?: number;
  leading?: number;
}): number {
  if (args.contentType === "motif") return args.motifHeightMm ?? args.motifSizeMm;
  if (args.contentType === "artwork") return args.artworkHeightMm ?? args.heightMm;
  const stack = Math.max(1, args.lineCount) * args.heightMm * (args.lineCount > 1 ? (args.leading ?? LINE_LEADING) : 1);
  if (!args.curveDeg) return stack;
  // Mirrors the server's stackHeightMm — see `curveArc` for the geometry.
  return stack + curveArc(args.widthMm, args.curveDeg).sagitta;
}

export type ValidationCode =
  | "empty"
  | "unstitchable"
  | "monogramLength"
  | "tooWide"
  | "tooTall"
  | "tooManyLines"
  | "motifSize"
  | "tooManyBoxes";

/** One box, measured. */
export interface ElementEvaluation {
  text: string;
  lines: string[];
  widthMm: number;
  /** Every line stacked, curve included — what has to fit the area's height. */
  stackMm: number;
  error: ValidationCode | null;
}

/** The position: every box, and the whole hoop priced as one run. */
export interface EditorEvaluation {
  elements: ElementEvaluation[];
  /** Every box's words, in order — what the review step spells out. */
  text: string;
  /** null while the design is invalid — there is nothing to quote yet. */
  priceCents: number | null;
  error: ValidationCode | null;
  /** Which box the error is on, or null for a position-level one. */
  errorElement: number | null;
  /** Distinct spools across the boxes — the machine's needles. */
  threadCount: number;
  /** The hoop fitted round the boxes, as the server will fit it. */
  hoop: { widthMm: number; heightMm: number; cx: number; cy: number };
}

/**
 * Mirrors STITCHABLE_TEXT / STITCHABLE_MONOGRAM on the server.
 *
 * Any script — `\p{L}` is every letter Unicode knows and `\p{M}` the combining
 * marks Arabic and Indic scripts need to spell anything. What stays refused is
 * what no machine lays in thread: emoji, arrows, control characters.
 */
const STITCHABLE_TEXT = /^[\p{L}\p{M}\p{N} '&.\-]+$/u;
const STITCHABLE_MONOGRAM = /^[\p{L}\p{M}]+$/u;
const COMBINING_MARK = /\p{M}/u;

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
  const widthMmRaw =
    contentType === "artwork"
      ? options.artworkSizeMm
      : contentType === "motif"
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

  // The border grows the letters outward on every side.
  const isLettering = contentType === "text" || contentType === "monogram";
  const borderMm = isLettering && placement.usesCustomerPhoto ? Math.max(0, options.borderMm || 0) : 0;
  const widthMm = widthMmRaw + 2 * borderMm;

  const stackMm =
    stackHeightMm({
      lineCount: lines.length,
      heightMm,
      widthMm: widthMmRaw,
      curveDeg: options.curveDeg,
      contentType,
      motifSizeMm: options.motifSizeMm,
      motifHeightMm: pictureSizeMm(options).heightMm,
      artworkHeightMm: pictureSizeMm(options).heightMm,
      leading: options.leading,
    }) +
    2 * borderMm;

  const base = { text, lines, widthMm, stackMm };
  const invalid = (error: ValidationCode): ElementEvaluation => ({ ...base, error });

  if (contentType === "artwork") {
    if (!options.artworkKey) return invalid("empty");
  } else if (contentType === "motif") {
    if (!options.motifKey) return invalid("empty");
    // No size band — see the server's `resolveMotif`. What is still true is that
    // both sides have to fit the field, and saying which way it will not fit is
    // more use than the server's catch-all. A shape has no lines, so the width
    // and height gates below never see it; this is where it is measured.
    const picture = pictureSizeMm(options);
    if (!(picture.widthMm > 0) || !(picture.heightMm > 0)) return invalid("motifSize");
    if (picture.widthMm > limits.maxWidthMm) return invalid("tooWide");
    if (picture.heightMm > limits.maxHeightMm) return invalid("tooTall");
  } else {
    if (!lines.length) return invalid("empty");
    if (lines.length > MAX_TEXT_LINES) return invalid("tooManyLines");

    for (const line of lines) {
      if (contentType === "monogram") {
        if (line.length < MONOGRAM_MIN_CHARS || line.length > MONOGRAM_MAX_CHARS) return invalid("monogramLength");
        if (!STITCHABLE_MONOGRAM.test(line)) return invalid("unstitchable");
      } else {
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
 * The position as a whole: every box checked, the hoop fitted round them, and
 * the price added up. Mirrors PersonalizationService.resolve.
 */
export function evaluateDesign(args: {
  elements: {
    raw: string;
    font: EditorFont;
    heightMm: number;
    weightStep?: number;
    options: DesignOptions;
    thread: EditorThread | undefined;
    /** The design in this box, when it holds one — its surcharge is part of the price. */
    motif?: EditorMotif;
    offset: { x: number; y: number };
    rotationDeg: number;
  }[];
  placement: EditorPlacement;
  limits: FieldLimits;
}): EditorEvaluation {
  const { placement, limits } = args;
  const elements = args.elements.map((el) =>
    evaluateElement({ raw: el.raw, font: el.font, placement, limits, heightMm: el.heightMm, weightStep: el.weightStep, options: el.options }),
  );
  const hoop = hoopAround(
    args.elements.map((el, i) => ({ offset: el.offset, rotationDeg: el.rotationDeg, widthMm: elements[i].widthMm, stackMm: elements[i].stackMm, heightMm: el.heightMm })),
  );
  const threads = new Map<string, EditorThread>();
  for (const el of args.elements) if (el.thread) threads.set(el.thread.id, el.thread);
  const threadCount = threads.size;

  const text = elements.map((el) => el.text).filter(Boolean).join("\n");
  const base = { elements, text, threadCount, hoop };
  const invalid = (error: ValidationCode, errorElement: number | null = null): EditorEvaluation => ({
    ...base,
    priceCents: null,
    error,
    errorElement,
  });

  if (!elements.length || elements.length > MAX_ELEMENTS) return invalid("tooManyBoxes");
  const broken = elements.findIndex((el) => el.error);
  if (broken >= 0) return invalid(elements[broken].error!, broken);
  // Boxes far apart need a hoop the machine does not have, however small each is.
  if (hoop.widthMm > limits.maxWidthMm) return invalid("tooWide");
  if (hoop.heightMm > limits.maxHeightMm) return invalid("tooTall");

  /**
   * The position's own price for the hooping and the run, plus each design's
   * own surcharge. Both are figures the shop typed — mirrors the server, which
   * is the authority. A second box on a position adds nothing: the hooping and
   * the run happen once however many boxes are in the frame.
   *
   * A send-in's position price IS the item type's flat side fee, so the same sum
   * covers both: the customer was quoted that figure per side, and only what
   * they then knowingly added to it moves the total.
   */
  const designCents = args.elements.reduce(
    (sum, el) => sum + (el.options.contentType === "motif" && el.motif ? (el.motif.priceCents ?? 0) : 0),
    0,
  );
  return { ...base, priceCents: placement.priceCents + designCents, error: null, errorElement: null };
}

/**
 * The smallest letter height the editor offers, in millimetres.
 *
 * A rail, not a judgement: a face used to declare its own 8–40mm range and
 * anything outside it was refused, which is an arbitrary answer to a question
 * the geometry already answers. The ceiling is the machine's frame and the fit
 * meter shows it; this is only here because a control has to start somewhere and
 * 0mm is not a size.
 */
export const TEXT_MIN_HEIGHT_MM = 1;
