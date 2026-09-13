/**
 * Geometry for the four corners an admin traces around an embroidery area.
 *
 * The corners answer two questions: where on the photograph the embroidery
 * goes, and how large it can be. They deliberately do NOT skew the artwork onto
 * themselves — a design mapped through a trapezoid has no side parallel to the
 * image, so a quarter turn comes out leaning and "vertical" never looks
 * vertical. `areaFromQuad` reduces a tracing to the upright box both the editor
 * and the storefront draw in.
 *
 * The homography is still here because `quadToUnit` needs it: deciding whether
 * a pointer is inside the traced shape is a question about the quad itself, and
 * that answer has to respect the shape the admin actually drew.
 *
 * Pure geometry with no DOM access, so it is equally usable from the storefront
 * editor and the admin studio.
 */

export interface Point {
  x: number;
  y: number;
}

/** Corners in the order the API stores them: TL, TR, BR, BL. */
export type Quad = [Point, Point, Point, Point];

type Matrix3 = number[]; // row-major, length 9

/**
 * The 3×3 homography taking the unit square (0,0)-(1,1) to `quad`.
 *
 * Solved as the composition of two simpler maps — unit square to quad is the
 * standard closed form below — which avoids a general 8×8 solve and the
 * numerical care that would need.
 */
function unitSquareToQuad(quad: Quad): Matrix3 {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;

  const den = dx1 * dy2 - dx2 * dy1;
  // A degenerate quad (three collinear corners) has no inverse. The caller
  // gets an identity rather than NaN spreading through a transform string and
  // silently blanking the layer.
  if (!den) return [1, 0, 0, 0, 1, 0, 0, 0, 1];

  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;

  return [
    p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x,
    p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y,
    g, h, 1,
  ];
}

function invert3(m: Matrix3): Matrix3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!det) return null;
  return [
    A / det, (c * h - b * i) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, (c * d - a * f) / det,
    C / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
}

function apply(m: Matrix3, p: Point): Point {
  const w = m[6] * p.x + m[7] * p.y + m[8];
  if (!w) return { x: 0, y: 0 };
  return {
    x: (m[0] * p.x + m[1] * p.y + m[2]) / w,
    y: (m[3] * p.x + m[4] * p.y + m[5]) / w,
  };
}



/**
 * Where a point inside the quad falls in the field's own coordinates, as a
 * fraction of its width and height.
 *
 * This is what turns a drag into millimetres: the pointer moves in the
 * photograph's space, but the design lives in the hoop field's, and on a quad
 * seen at an angle those two do not move together — a drag of 10 screen pixels
 * covers more of the field near the far edge than the near one.
 */
export function quadToUnit(quad: Quad, point: Point): Point | null {
  const inv = invert3(unitSquareToQuad(quad));
  if (!inv) return null;
  return apply(inv, point);
}

/** The traced area reduced to a straight box: where it is, and how big. */
export interface Area {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * An upright box covering the quad.
 *
 * The four corners say where the embroidery goes and how large it is; the
 * design is then drawn square to the photograph rather than skewed onto them.
 * That is what makes a quarter turn look like a quarter turn — mapped through a
 * trapezoid, 90° comes out leaning and "vertical" never looks vertical.
 *
 * Width and height are the averages of the opposite edges, so a slightly
 * imprecise tracing still yields the size the admin meant.
 */
export function areaFromQuad(quad: Quad): Area {
  const [tl, tr, br, bl] = quad;
  return {
    cx: (tl.x + tr.x + br.x + bl.x) / 4,
    cy: (tl.y + tr.y + br.y + bl.y) / 4,
    width: (dist(tl, tr) + dist(bl, br)) / 2,
    height: (dist(tl, bl) + dist(tr, br)) / 2,
  };
}


/** An axis-aligned box, as the starting shape for a zone nobody has drawn yet. */
export function defaultQuad(xPct = 34, yPct = 42, wPct = 32, hPct = 15): Quad {
  return [
    { x: xPct, y: yPct },
    { x: xPct + wPct, y: yPct },
    { x: xPct + wPct, y: yPct + hPct },
    { x: xPct, y: yPct + hPct },
  ];
}

/** Rejects a quad that has collapsed or turned inside out. */
export function isUsableQuad(quad: Quad | null | undefined): quad is Quad {
  if (!quad || quad.length !== 4) return false;
  if (quad.some((p) => !Number.isFinite(p?.x) || !Number.isFinite(p?.y))) return false;
  // Shoelace area — a self-intersecting or zero-area quad cannot be mapped on to.
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area / 2) > 0.5;
}
