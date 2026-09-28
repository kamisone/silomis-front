/**
 * Where an embroidery area sits on a photograph, and how big it is.
 *
 * Two shapes reach this, and only one of them is a quad:
 *
 * - A **catalogue position** states its area directly, as a share of its own
 *   photo (`areaFromBox`). It used to be four corners an admin traced, which is
 *   gone: the corners never carried more than a centre and a size. They were
 *   deliberately never skewed onto the artwork — a design mapped through a
 *   trapezoid has no side parallel to the image, so a quarter turn comes out
 *   leaning and "vertical" never looks vertical — so a tracing was averaged
 *   down to exactly this before anything was drawn.
 * - A **customer's own item** on a send-in still arrives as four corners
 *   (`areaFromQuad`): the customer frames the panel on the photo they sent, and
 *   nobody else can know where it is.
 *
 * Pure geometry with no DOM access, so the storefront editor and the admin can
 * share it.
 */

export interface Point {
  x: number;
  y: number;
}

/** Corners in the order the API stores them: TL, TR, BR, BL. */
export type Quad = [Point, Point, Point, Point];

/** An embroidery area on a photo: where its centre is, and how big it is, in rendered pixels. */
export interface Area {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * An upright box covering the quad — a send-in's only path in.
 *
 * Width and height are the averages of the opposite edges, so a customer's
 * slightly imprecise framing still yields the size they meant. The design is
 * then drawn square to the photograph rather than skewed onto the corners,
 * which is what makes a quarter turn look like a quarter turn.
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

/** Where a catalogue position's embroidery area sits on its photo, as percentages. */
export interface AreaBox {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}

/** That box in the rendered pixels of a photo measured `boxW` × `boxH`. */
export function areaFromBox(box: AreaBox, boxW: number, boxH: number): Area {
  return {
    cx: ((box.xPct + box.widthPct / 2) / 100) * boxW,
    cy: ((box.yPct + box.heightPct / 2) / 100) * boxH,
    width: (box.widthPct / 100) * boxW,
    height: (box.heightPct / 100) * boxH,
  };
}
