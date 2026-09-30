"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Move, RotateCw } from "lucide-react";
import { areaFromBox, areaFromQuad, isUsableQuad, type Area, type Point, type Quad } from "@/lib/shop/perspective";
import {
  MAX_TRAVEL_FACTOR, LINE_LEADING, MAX_TEXT_CHARS, MONOGRAM_MAX_CHARS, weightForStep, lineWidthMm, normalizeText,
  type ContentKind, type EditorFont, type EditorPlacement, type EditorThread,
} from "@/lib/shop/embroidery";
import styles from "./PersonalizationEditor.module.css";

/** One box, as the preview draws it. Measurements come from the evaluator. */
export interface PreviewElement {
  id: string;
  font: EditorFont;
  contentType: ContentKind;
  /** Normalised text; empty while nothing has been written. */
  text: string;
  /** Exactly what the customer typed, which is what the field edits. */
  raw: string;
  lines: string[];
  heightMm: number;
  weightStep: number;
  /** A satin border round the letters, in millimetres. */
  borderMm?: number;
  /** Line spacing as a multiple of the letter height. */
  leading?: number;
  thread: EditorThread;
  curveDeg: number;
  trackingPct: number;
  kerning: number[] | null;
  motif: {
    path: string;
    viewBox: string;
    sizeMm: number;
    heightMm: number;
    /** Every shape of the design, in drawing order. */
    paths?: { d: string; fill: string; transform?: string }[] | null;
    /** Sewn in those shapes' own fills, rather than in the box's thread. */
    ownColours?: boolean;
  } | null;
  /** The customer's own logo: its rendering, at the size it will be stitched. */
  artwork: { url: string; widthMm: number; heightMm: number } | null;
  /** From the evaluator — the width the fit check measured. */
  widthMm: number;
  stackMm: number;
  /** From the position's traced centre, in millimetres. */
  offset: Point;
  rotationDeg: number;
  invalid: boolean;
}

interface Props {
  imageUrl: string | null;
  productTitle: string;
  placement: EditorPlacement;
  elements: PreviewElement[];
  activeElementId: string | null;
  onSelectElement: (id: string) => void;
  /**
   * The customer typed into the photograph. Raw, not normalised: the editor owns
   * the value and the evaluator normalises a copy, so backspacing through a
   * space behaves the way it does in any text field.
   */
  onTextChange: (id: string, raw: string) => void;
  /** Names the hidden field that takes the keystrokes, for a screen reader. */
  textLabel: string;
  onElementChange: (
    id: string,
    patch: {
      offset?: Point;
      rotationDeg?: number;
      /**
       * The box's new size in its own axes, and which handle asked for it. A
       * picture takes both numbers directly; lettering has no width of its own
       * to set — its width follows the letters — so the editor reads the axis
       * and turns the pull into the control that actually moves that side.
       */
      size?: { widthMm: number; heightMm: number; axis: "x" | "y" | "xy" };
    },
  ) => void;
  /** What an empty box reads, drawn faintly until the customer writes. */
  placeholder: string;
  /** What an empty logo box says — "Your logo" — while nothing is uploaded yet. */
  logoPlaceholder?: string;
  /** The area the admin traced on this photo, in % of the image box. */
  quadPct: Quad | null;
  dragHint: string;
  /** Copy for the screen-reader instructions on the draggable things. */
  moveLabel: string;
  rotateLabel: string;
  resizeLabel?: string;
  /** False on the review step, where the design is being confirmed, not edited. */
  editable?: boolean;
  /**
   * Whether pressing a box means anything.
   *
   * True while the design is being worked on, and also on a photograph that is
   * not open but can be opened — pressing that is how a customer switches to it.
   * False where the drawing is only a picture: the position cards, and the
   * thumbnails beside the working canvas, which have one target of their own
   * around the whole photo. A layer that is not interactive does not claim to be
   * a button, which it was doing regardless — announcing a control to a screen
   * reader that did nothing when pressed.
   */
  selectable?: boolean;
}

/**
 * The design, drawn onto the product photograph.
 *
 * Every box is its own layer on the photo, drawn at its own millimetre size in
 * its own spool, moved and turned on its own. There is no frame to size: the
 * hoop is fitted round the boxes afterwards, on the server. Everything is in
 * the photograph's own pixels, converted from millimetres by the traced
 * panel's real size, so what the customer lines up by eye is what gets
 * stitched — a 20mm name occupies exactly 20mm of the cap.
 */
export default function DesignPreview({
  imageUrl,
  productTitle,
  placement,
  elements,
  activeElementId,
  onSelectElement,
  onTextChange,
  textLabel,
  onElementChange,
  placeholder,
  logoPlaceholder = "Logo",
  quadPct,
  dragHint,
  moveLabel,
  rotateLabel,
  resizeLabel = "Resize",
  editable = true,
  selectable = true,
}: Props) {
  /** Whether a press on a box does anything at all — see `selectable`. */
  const interactive = editable || selectable;
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [gesture, setGesture] = useState<"none" | "element" | "rotate" | "resize">("none");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /**
   * Whether the guides are shown. They exist to aim with, and once the aiming
   * is done they are the only thing standing between the customer and a clean
   * look at their cap — a press on the bare photo puts them away.
   */
  const [showGuides, setShowGuides] = useState(true);

  const elementDrag = useRef<{ id: string; startX: number; startY: number; start: Point } | null>(null);
  const spin = useRef<{ id: string; startAngle: number; startRotation: number } | null>(null);
  const stretch = useRef<{ id: string; axis: "x" | "y" | "xy"; startX: number; startY: number; startW: number; startH: number; rotationDeg: number } | null>(null);

  // The tracing is stored in percentages so it survives every rendered size;
  // the layout needs pixels, so the box has to be measured rather than assumed.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A different position is a different design under the same controls, so the
  // guides come back — otherwise switching tabs after putting one down leaves
  // the next one looking uneditable.
  useEffect(() => setShowGuides(true), [placement.key, activeElementId]);

  const measured = box.width > 0 && box.height > 0;

  /**
   * The embroidery area on this photograph.
   *
   * One shape, two sources: a customer's own item arrives as the four corners
   * they framed on their own photo, and everything else states its area as a
   * share of the position's photo. Both reduce to a centre and a size, which is
   * all anything below uses — so there is no second, non-interactive rendering
   * path any more. The admin's four-corner tracing was removed; it never
   * carried more than this box.
   */
  const area: Area | null = !measured
    ? null
    : isUsableQuad(quadPct)
      ? areaFromQuad(quadPct.map((p) => ({ x: (p.x / 100) * box.width, y: (p.y / 100) * box.height })) as Quad)
      : areaFromBox(placement.preview, box.width, box.height);

  /** Screen pixels per millimetre — the panel's stated size is the scale. */
  const pxPerMm = area ? area.width / placement.fieldWidthMm : 0;

  /**
   * How far a box may travel over the photograph: MAX_TRAVEL_FACTOR × the
   * traced panel, the same rule the server applies, so the pointer never
   * shows a position add-to-cart would snap back from.
   */
  const clampElement = useCallback(
    (next: Point): Point => {
      const maxX = placement.fieldWidthMm * MAX_TRAVEL_FACTOR;
      const maxY = placement.fieldHeightMm * MAX_TRAVEL_FACTOR;
      return { x: Math.min(maxX, Math.max(-maxX, next.x)), y: Math.min(maxY, Math.max(-maxY, next.y)) };
    },
    [placement.fieldWidthMm, placement.fieldHeightMm],
  );

  const round1 = (n: number) => Math.round(n * 10) / 10;

  // ── Typing on the photograph ─────────────────────────────────────────
  // There is no "text to embroider" field beside the preview any more: the
  // customer writes on the cap. A hidden textarea takes the keystrokes and the
  // SVG stays the only renderer — it draws every line at exactly the width the
  // validator measured, which no HTML overlay could match, so an editable
  // element over the top would drift from the letters underneath it.
  //
  // It is deliberately NOT stretched across the box: a transparent field over
  // the lettering would swallow the drag that moves it and the handle that
  // turns it. A tap opens it instead, and it stays in the tab order so a
  // keyboard reaches it without pointing at anything.

  const textRef = useRef<HTMLTextAreaElement>(null);
  const [typing, setTyping] = useState(false);
  /**
   * Where the field's own caret sits, as an index into the RAW text.
   *
   * State rather than a ref because the caret can move without the text
   * changing — an arrow key, a click, Home — and the measurement below has to
   * re-run when it does.
   */
  const [caretIndex, setCaretIndex] = useState(0);
  /** The drawn `<text>` per line of the box being typed into, for measuring. */
  const rowRefs = useRef<(SVGTextElement | null)[]>([]);
  const caretRef = useRef<SVGRectElement>(null);
  /**
   * What the pointer went down on, cleared by any movement: a drag across the
   * photograph must not also open a keyboard. It records whether the box was
   * lettering rather than reading that off the active element later, because
   * the tap may be what MADE it active — the closure would still be looking at
   * the box that was open before.
   */
  const tapped = useRef<{ el: PreviewElement; x: number; y: number } | null>(null);

  /** The box the keystrokes belong to, or null while a picture is open. */
  const typingTarget = (() => {
    const open = elements.find((el) => el.id === activeElementId);
    return open && (open.contentType === "text" || open.contentType === "monogram") ? open : null;
  })();

  // Opening a picture puts the keyboard away: there is nothing to write into,
  // and a bar blinking on a shape the customer cannot type on is a lie. The
  // field stays mounted, so nothing else clears this.
  useEffect(() => {
    if (!typingTarget && typing) textRef.current?.blur();
  }, [typingTarget, typing]);

  /**
   * Puts the drawn caret where the field's own caret is.
   *
   * Written straight onto the `<rect>` rather than through state, because this
   * has to run AFTER the letters are laid out — it measures them — and a state
   * update from a layout effect would cost a second render per keystroke.
   *
   * The hard part is that the drawn lines are the NORMALISED text while the
   * caret indexes the RAW text: `normalizeText` collapses runs of spaces, drops
   * blank lines and can upper-case a face's letters. So the raw prefix in front
   * of the caret is put through exactly the same normalisation, and its length
   * is the column in the drawn line. A trailing space the customer just typed
   * therefore leaves the caret where the next visible letter will land, which is
   * the honest place for it.
   *
   * The position itself comes from the DOM (`getStartPositionOfChar`), never from
   * our own width model: each line is stretched to the measured width with
   * `textLength`, so only the browser knows where a glyph ended up inside it.
   */
  useLayoutEffect(() => {
    const bar = caretRef.current;
    if (!bar) return;
    const el = typingTarget;
    if (!el) return;

    const rows = el.lines;
    const lead = el.heightMm * (el.leading ?? LINE_LEADING);
    const firstY = -((Math.max(1, rows.length) - 1) * lead) / 2;
    const barW = Math.max(0.5, el.heightMm * 0.07);

    // An empty box: the lettering is centre-anchored, so the first letter lands
    // in the middle. Nothing to measure.
    if (!rows.length) {
      bar.setAttribute("x", String(-barW / 2));
      bar.setAttribute("y", String(-el.heightMm / 2));
      return;
    }

    // Which raw line the caret is on, and how far into it.
    const rawLines = el.raw.split(/\r?\n/);
    const caret = Math.max(0, Math.min(caretIndex, el.raw.length));
    let consumed = 0;
    let rawLine = rawLines.length - 1;
    let column = rawLines[rawLine]?.length ?? 0;
    for (let i = 0; i < rawLines.length; i += 1) {
      const len = rawLines[i].length;
      if (caret <= consumed + len) {
        rawLine = i;
        column = caret - consumed;
        break;
      }
      consumed += len + 1;
    }

    // Blank raw lines are not drawn, so the drawn row is the count of lines
    // before this one that survived normalisation.
    const normalise = (text: string) => normalizeText(text, el.contentType, el.font.uppercaseOnly);
    let rowIdx = 0;
    for (let i = 0; i < rawLine; i += 1) if (normalise(rawLines[i])) rowIdx += 1;
    rowIdx = Math.min(rowIdx, rows.length - 1);

    const drawnCol = Math.min(normalise(rawLines[rawLine].slice(0, column)).length, rows[rowIdx].length);
    const textEl = rowRefs.current[rowIdx];
    const y = firstY + rowIdx * lead;

    let x: number | null = null;
    if (textEl && rows[rowIdx].length) {
      try {
        const point = drawnCol > 0 ? textEl.getEndPositionOfChar(drawnCol - 1) : textEl.getStartPositionOfChar(0);
        x = point.x;
      } catch {
        // The character is not laid out yet — a face still loading, or a row
        // React has not flushed. The fallback below is still a sane place.
        x = null;
      }
    }
    if (x === null) {
      // No measurement to be had: sit at the end of the line, which is where
      // typing lands, using the width the validator measured.
      x =
        lineWidthMm({
          line: rows[rowIdx],
          heightMm: el.heightMm,
          font: el.font,
          contentType: el.contentType,
          weightStep: el.weightStep,
          trackingPct: el.trackingPct,
          kerning: el.kerning,
        }) / 2;
    }

    bar.setAttribute("x", String(x - barW / 2));
    bar.setAttribute("y", String(y - el.heightMm / 2));
  });

  /**
   * The raw index a tap on the lettering points at, or null when it cannot be
   * worked out (a face still loading, a curved line, a tap off the letters).
   *
   * The inverse of the mapping the layout effect does: the DOM says which drawn
   * character was hit, and the raw column is then the shortest prefix of the raw
   * line that normalises to that many characters. Lossy in the same place and
   * for the same reason — a run of spaces is one space once drawn — and landing
   * on the first raw index that renders to the tapped spot is the right answer
   * there.
   */
  const caretIndexAt = useCallback((el: PreviewElement, clientX: number, clientY: number): number | null => {
    if (!el.lines.length || el.curveDeg) return null;
    const svg = rowRefs.current.find(Boolean)?.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;

    // Screen coordinates into the box's own user space, which is what carries
    // the box's rotation and the photograph's scale.
    const local = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());

    const lead = el.heightMm * (el.leading ?? LINE_LEADING);
    const firstY = -((el.lines.length - 1) * lead) / 2;
    const rowIdx = Math.max(0, Math.min(el.lines.length - 1, Math.round((local.y - firstY) / (lead || 1))));
    const textEl = rowRefs.current[rowIdx];
    if (!textEl) return null;

    const line = el.lines[rowIdx];
    let drawnCol = line.length;
    try {
      const hit = textEl.getCharNumAtPosition(local);
      if (hit >= 0) {
        // Past the middle of a glyph the caret belongs after it, the way it does
        // in any text field.
        const start = textEl.getStartPositionOfChar(hit);
        const end = textEl.getEndPositionOfChar(hit);
        drawnCol = local.x > (start.x + end.x) / 2 ? hit + 1 : hit;
      } else {
        // Off the ends of the line: the nearer end wins.
        const first = textEl.getStartPositionOfChar(0);
        drawnCol = local.x < first.x ? 0 : line.length;
      }
    } catch {
      return null;
    }

    const rawLines = el.raw.split(/\r?\n/);
    const normalise = (text: string) => normalizeText(text, el.contentType, el.font.uppercaseOnly);
    // Which raw line drew this row: count the ones before it that survived.
    let rawLine = rawLines.length - 1;
    let drawn = 0;
    for (let i = 0; i < rawLines.length; i += 1) {
      if (!normalise(rawLines[i])) continue;
      if (drawn === rowIdx) {
        rawLine = i;
        break;
      }
      drawn += 1;
    }

    let column = rawLines[rawLine].length;
    for (let i = 0; i <= rawLines[rawLine].length; i += 1) {
      if (normalise(rawLines[rawLine].slice(0, i)).length >= drawnCol) {
        column = i;
        break;
      }
    }

    let offset = 0;
    for (let i = 0; i < rawLine; i += 1) offset += rawLines[i].length + 1;
    return offset + column;
  }, []);

  /** Opens the keyboard, with the caret where the customer put it. */
  const startTyping = useCallback(
    (at?: { el: PreviewElement; x: number; y: number }) => {
      const field = textRef.current;
      if (!field) return;
      // Focus has to happen inside the gesture that asked for it, or a phone
      // keyboard will not come up. `preventScroll` because the field is clipped
      // to a pixel: without it the browser scrolls the page to bring that pixel
      // into view, jumping the photograph the customer just tapped out from
      // under them.
      field.focus({ preventScroll: true });
      // Where they tapped, if that can be worked out — on a phone there are no
      // arrow keys, so a tap is the only way to move the cursor at all. Failing
      // that, the end: a tap with nothing to measure means "carry on from here".
      const at_ = at ? caretIndexAt(at.el, at.x, at.y) : null;
      const index = at_ ?? field.value.length;
      field.setSelectionRange(index, index);
      setCaretIndex(index);
    },
    [caretIndexAt],
  );

  // ── Moving a box ─────────────────────────────────────────────────────

  const onElementDown = useCallback(
    (el: PreviewElement) => (e: React.PointerEvent) => {
      e.stopPropagation();
      onSelectElement(el.id);
      setShowGuides(true);
      if (!editable) return;
      tapped.current =
        el.contentType === "text" || el.contentType === "monogram" ? { el, x: e.clientX, y: e.clientY } : null;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      elementDrag.current = { id: el.id, startX: e.clientX, startY: e.clientY, start: el.offset };
      setDraggingId(el.id);
      setGesture("element");
    },
    [editable, onSelectElement],
  );

  const onElementMove = useCallback(
    (e: React.PointerEvent) => {
      const d = elementDrag.current;
      if (!d || !pxPerMm) return;
      // Past a few pixels this is a drag, not a tap, so it must not also open
      // the keyboard when the finger lifts.
      if (Math.abs(e.clientX - d.startX) > 4 || Math.abs(e.clientY - d.startY) > 4) tapped.current = null;
      // Screen pixels straight to millimetres, along the photograph's own
      // axes, so a drag goes exactly where the pointer goes whatever angle
      // the box is at.
      onElementChange(d.id, {
        offset: clampElement({ x: round1(d.start.x + (e.clientX - d.startX) / pxPerMm), y: round1(d.start.y + (e.clientY - d.startY) / pxPerMm) }),
      });
    },
    [onElementChange, clampElement, pxPerMm],
  );

  const onElementKeyDown = useCallback(
    (el: PreviewElement) => (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 5 : 1;
      const delta: Record<string, Point> = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
      };
      const d = delta[e.key];
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      onElementChange(el.id, { offset: clampElement({ x: el.offset.x + d.x, y: el.offset.y + d.y }) });
    },
    [onElementChange, clampElement],
  );

  const endGesture = useCallback(() => {
    const tap = elementDrag.current ? tapped.current : null;
    tapped.current = null;
    elementDrag.current = null;
    spin.current = null;
    stretch.current = null;
    setDraggingId(null);
    setGesture("none");
    // A tap on lettering is a request to write on it. Focus happens here, still
    // inside the gesture the customer made — a phone opens no keyboard for a
    // focus() that arrives from an effect a frame later.
    if (tap) startTyping(tap);
  }, [startTyping]);

  // ── Turning a box ────────────────────────────────────────────────────

  /** A box's centre on screen, which every angle is measured around. */
  const centreOf = useCallback(
    (el: PreviewElement): Point | null =>
      area ? { x: area.cx + el.offset.x * pxPerMm, y: area.cy + el.offset.y * pxPerMm } : null,
    [area, pxPerMm],
  );

  const pointerAngle = useCallback(
    (e: React.PointerEvent, centre: Point): number => {
      const rect = wrapRef.current!.getBoundingClientRect();
      return (Math.atan2(e.clientY - rect.top - centre.y, e.clientX - rect.left - centre.x) * 180) / Math.PI;
    },
    [],
  );

  const onRotateDown = useCallback(
    (el: PreviewElement) => (e: React.PointerEvent) => {
      const centre = centreOf(el);
      if (!centre) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      spin.current = { id: el.id, startAngle: pointerAngle(e, centre), startRotation: el.rotationDeg };
      setGesture("rotate");
    },
    [centreOf, pointerAngle],
  );

  const onRotateMove = useCallback(
    (el: PreviewElement) => (e: React.PointerEvent) => {
      const s = spin.current;
      const centre = centreOf(el);
      if (!s || !centre) return;
      const next = s.startRotation + (pointerAngle(e, centre) - s.startAngle);
      // Shift snaps to 15°, which is what makes a deliberately straight or
      // diagonal box reachable with a pointer at all.
      onElementChange(s.id, { rotationDeg: e.shiftKey ? Math.round(next / 15) * 15 : Math.round(next * 10) / 10 });
    },
    [centreOf, pointerAngle, onElementChange],
  );

  const onRotateKeyDown = useCallback(
    (el: PreviewElement) => (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 15 : 1;
      const delta: Record<string, number> = { ArrowLeft: -step, ArrowRight: step, ArrowDown: -step, ArrowUp: step };
      const d = delta[e.key];
      if (d === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      onElementChange(el.id, { rotationDeg: Math.round((el.rotationDeg + d) * 10) / 10 });
    },
    [onElementChange],
  );

  // ── Stretching a shape ───────────────────────────────────────────────
  // Three handles on a picture box: the right edge for width, the bottom
  // edge for height, the corner for both together. The pointer's travel is
  // turned into the box's own axes first, so a turned shape still grows the
  // way its handle is pulled.

  /**
   * `drawnW`/`drawnH` are the box as the preview just measured it, which is the
   * only size lettering has: a picture carries its own width and height, a line
   * of text is however wide the letters came out.
   */
  const onResizeDown = useCallback(
    (el: PreviewElement, axis: "x" | "y" | "xy", drawnW: number, drawnH: number) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const w = el.motif ? el.motif.sizeMm : el.artwork ? el.artwork.widthMm : drawnW;
      const h = el.motif ? el.motif.heightMm : el.artwork ? el.artwork.heightMm : drawnH;
      stretch.current = { id: el.id, axis, startX: e.clientX, startY: e.clientY, startW: w, startH: h, rotationDeg: el.rotationDeg };
      setGesture("resize");
    },
    [],
  );

  const onResizeMove = useCallback(
    (e: React.PointerEvent) => {
      const st = stretch.current;
      if (!st || !pxPerMm) return;
      const dx = (e.clientX - st.startX) / pxPerMm;
      const dy = (e.clientY - st.startY) / pxPerMm;
      const a = (st.rotationDeg * Math.PI) / 180;
      // Along the box's own axes.
      const along = dx * Math.cos(a) + dy * Math.sin(a);
      const across = -dx * Math.sin(a) + dy * Math.cos(a);
      let widthMm = st.startW;
      let heightMm = st.startH;
      if (st.axis === "x") widthMm = st.startW + 2 * along;
      else if (st.axis === "y") heightMm = st.startH + 2 * across;
      else {
        // The corner keeps the proportion: the larger pull wins.
        const k = Math.max((st.startW + 2 * along) / st.startW, (st.startH + 2 * across) / st.startH);
        widthMm = st.startW * k;
        heightMm = st.startH * k;
      }
      onElementChange(st.id, { size: { widthMm: Math.max(5, round1(widthMm)), heightMm: Math.max(5, round1(heightMm)), axis: st.axis } });
    },
    [onElementChange, pxPerMm],
  );

  /** A press on the bare photo puts the guides away. */
  const onStagePointerDown = useCallback((e: React.PointerEvent) => {
    const stage = stageRef.current;
    if (stage && e.target instanceof Element && e.target.closest(`.${styles.elementLayer}`)) return;
    setShowGuides(false);
  }, []);

  const busy = gesture !== "none";
  const guides = editable && showGuides;

  // ── Drawing a box ────────────────────────────────────────────────────

  const drawElement = (el: PreviewElement) => {
    const empty = !el.text && !el.motif && !el.artwork;
    const logoPending = el.contentType === "artwork" && !el.artwork;
    /** This box has the keyboard, so it shows where the next letter lands. */
    const focusedHere = typing && el.id === typingTarget?.id;
    /**
     * The prompt, until the customer is actually writing.
     *
     * "Your text" is there to say where to tap. Once the keyboard is open the
     * bar says the same thing, and leaving the words under a bar blinking
     * through their middle reads as a glitch — and asks someone to type over a
     * word that is not theirs.
     */
    const rows = el.lines.length ? el.lines : empty && focusedHere ? [] : [el.text || placeholder];
    // Cap height is not the em box — 0.72 is the usual ratio, and using it
    // keeps the rendered letters at the millimetre height being quoted.
    const fontSizeMm = el.heightMm / 0.72;
    const lead = el.heightMm * (el.leading ?? LINE_LEADING);
    const firstY = -((rows.length - 1) * lead) / 2;
    const fill = el.thread.hex;

    // An empty box has no measured width yet; it draws its placeholder at the
    // width that text would have, so the box is the right size to aim with.
    const widthMm = Math.max(
      1,
      logoPending
        ? el.widthMm
        : empty && !el.motif && !el.artwork
        ? lineWidthMm({ line: placeholder, heightMm: el.heightMm, font: el.font, contentType: el.contentType, weightStep: el.weightStep, trackingPct: el.trackingPct, kerning: null })
        : el.widthMm,
    );
    const stackMm = Math.max(1, logoPending ? el.stackMm : empty ? el.heightMm : el.stackMm);
    const chord = Math.max(1, el.motif ? el.motif.sizeMm : el.widthMm || widthMm);

    const body = logoPending
      ? // Nothing uploaded yet: a dashed frame at the width the logo will be,
        // so there is something to aim with before the file is in.
        (
          <g>
            <rect x={-widthMm / 2} y={-stackMm / 2} width={widthMm} height={stackMm} rx={2} fill="rgb(255 255 255 / 55%)" stroke={fill} strokeWidth={0.6} strokeDasharray="2.5 1.5" />
            <text x={0} y={0} fontFamily="system-ui, sans-serif" fontSize={Math.max(3, Math.min(8, stackMm / 3))} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={fill}>
              {logoPlaceholder}
            </text>
          </g>
        )
      : el.artwork
      ? // The file itself, centred on the box's origin at its stitched size —
        // the same picture the server's mockup composites later.
        (
          <image
            href={el.artwork.url}
            x={-el.artwork.widthMm / 2}
            y={-el.artwork.heightMm / 2}
            width={el.artwork.widthMm}
            height={el.artwork.heightMm}
            preserveAspectRatio="xMidYMid meet"
          />
        )
      : el.motif
      ? (() => {
          const [, , vw, vh] = el.motif.viewBox.split(/\s+/).map(Number);
          const sx = el.motif.sizeMm / (vw || 100);
          const sy = el.motif.heightMm / (vh || 100);
          return (
            <g transform={`translate(${-((vw || 100) * sx) / 2} ${-((vh || 100) * sy) / 2}) scale(${sx} ${sy})`}>
              {/* The shapes are the drawing; the thread only decides what
                  fills them. A one-spool design draws all of them in `fill`,
                  because that is what the machine will lay. */}
              {el.motif.paths?.length
                ? el.motif.paths.map((sp, i) => <path key={i} d={sp.d} fill={el.motif!.ownColours ? sp.fill : fill} transform={sp.transform} />)
                : <path d={el.motif.path} fill={fill} />}
            </g>
          );
        })()
      : rows.map((line, i) => {
          const y = firstY + i * lead;
          // Every line is drawn at exactly the width the validator measures,
          // whatever the browser's stand-in font would have made of it.
          const lineMm = empty
            ? widthMm
            : lineWidthMm({ line, heightMm: el.heightMm, font: el.font, contentType: el.contentType, weightStep: el.weightStep, trackingPct: el.trackingPct, kerning: el.kerning });
          const common = {
            fontFamily: el.font.webFamily,
            fontSize: fontSizeMm,
            fontWeight: weightForStep(el.weightStep).cssWeight,
            fill,
            // The hairline keeps thin faces from breaking up; a border set by
            // the customer replaces it, painted under the fill so the letters
            // grow outward by exactly those millimetres.
            stroke: fill,
            strokeWidth: el.borderMm ? 2 * el.borderMm : fontSizeMm * 0.012,
            strokeLinejoin: "round" as const,
            paintOrder: "stroke" as const,
            textAnchor: "middle" as const,
            opacity: empty ? 0.45 : 1,
          };
          if (!el.curveDeg) {
            return (
              <text
                key={i}
                // Only the open box needs measuring, and only its straight
                // lines — a curved one's letters ride a path. It is the OPEN box
                // rather than the focused one because the tap that focuses it
                // has to be measurable against it in the same gesture.
                ref={el.id === activeElementId ? (node) => { rowRefs.current[i] = node; } : undefined}
                x={0}
                y={y}
                dominantBaseline="central"
                textLength={lineMm > 0 ? lineMm : undefined}
                lengthAdjust="spacingAndGlyphs"
                {...common}
              >
                {line}
              </text>
            );
          }
          // The baseline rides a circular arc whose chord is the width the
          // straight version would have had, so bending a word does not also
          // resize it.
          const half = (Math.abs(el.curveDeg) * Math.PI) / 360;
          const radius = chord / (2 * Math.sin(half));
          const sweep = el.curveDeg > 0 ? 1 : 0;
          const dy = el.curveDeg > 0 ? radius - radius * Math.cos(half) : -(radius - radius * Math.cos(half));
          const id = `pv-${el.id}-arc-${i}`;
          const d = `M ${-chord / 2} ${y + dy} A ${radius} ${radius} 0 0 ${sweep} ${chord / 2} ${y + dy}`;
          return (
            <g key={i}>
              <path id={id} d={d} fill="none" />
              <text {...common}>
                <textPath href={`#${id}`} startOffset="50%" textLength={lineMm > 0 ? lineMm : undefined} lengthAdjust="spacingAndGlyphs">
                  {line}
                </textPath>
              </text>
            </g>
          );
        });

    /**
     * Where the next letter lands, while this box has the keyboard.
     *
     * An indicator, not a caret: the drawn lines are the NORMALISED text (spaces
     * collapsed, blank lines dropped), so a raw caret index cannot be mapped
     * onto them faithfully — and a caret that claims a position it does not have
     * is worse than one that only ever claims the end. Typing lands here, which
     * is where the field's own caret is put when it opens.
     *
     * An EMPTY box puts it in the middle, because that is where the first letter
     * will appear: the lettering is centre-anchored, so an empty line's
     * insertion point is the centre of the box, not the right-hand edge where
     * the prompt happened to end.
     */
    // The caret. Rendered at the origin and moved by the layout effect above,
    // which is the only thing that can know where a glyph ended up inside a line
    // stretched to a measured width.
    const barW = Math.max(0.5, el.heightMm * 0.07);
    const bar =
      focusedHere && !el.motif && !el.artwork ? (
        <rect ref={caretRef} className={styles.typeBar} x={-barW / 2} y={-el.heightMm / 2} width={barW} height={el.heightMm} fill={fill} />
      ) : null;

    return { widthMm, stackMm, body: bar ? <>{body}{bar}</> : body };
  };

  return (
    <div className={styles.previewStage}>
      <div className={styles.previewImageWrap} ref={wrapRef} onPointerDown={editable ? onStagePointerDown : undefined}>
        {imageUrl ? (
          // A signed URL (the customer's own photo) carries a query string the
          // optimiser's allow-list refuses, and it expires anyway — served as is.
          <Image src={imageUrl} alt={productTitle} fill sizes="(max-width: 900px) 100vw, 520px" className={styles.previewImage} priority unoptimized={imageUrl.includes("?")} />
        ) : (
          <div className={styles.previewImageFallback} aria-hidden="true" />
        )}

        {area ? (
          <div ref={stageRef} className={styles.boxStage} aria-hidden={false}>
            {elements.map((el) => {
              const { widthMm, stackMm, body } = drawElement(el);
              const selected = el.id === activeElementId;
              return (
                <div
                  key={el.id}
                  role={interactive ? "button" : undefined}
                  aria-label={interactive ? `${moveLabel} — ${el.text || (el.artwork ? "logo" : el.motif ? "motif" : placeholder)}` : undefined}
                  aria-pressed={interactive ? selected : undefined}
                  tabIndex={interactive ? (editable ? 0 : -1) : undefined}
                  className={[
                    styles.elementLayer,
                    selected && guides ? styles.elementLayerSelected : "",
                    el.invalid ? styles.elementLayerInvalid : "",
                    draggingId === el.id ? styles.elementLayerDragging : "",
                    typing && selected ? styles.elementLayerTyping : "",
                  ].join(" ")}
                  style={{
                    left: area.cx + el.offset.x * pxPerMm,
                    top: area.cy + el.offset.y * pxPerMm,
                    width: widthMm * pxPerMm,
                    height: stackMm * pxPerMm,
                    transform: `translate(-50%, -50%) rotate(${el.rotationDeg}deg)`,
                    // The open box sits on top: a new one starts at the centre,
                    // where another may already be, and has to be the one a
                    // press lands on.
                    zIndex: selected ? 2 : 1,
                  }}
                  onPointerDown={interactive ? onElementDown(el) : undefined}
                  onPointerMove={interactive ? onElementMove : undefined}
                  onPointerUp={interactive ? endGesture : undefined}
                  onPointerCancel={interactive ? endGesture : undefined}
                  onKeyDown={(e) => {
                    if (editable && el.id === activeElementId && typingTarget && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      startTyping();
                      return;
                    }
                    onElementKeyDown(el)(e);
                  }}
                  onFocus={interactive ? () => onSelectElement(el.id) : undefined}
                >
                  <svg className={styles.elementSvg} viewBox={`${-widthMm / 2} ${-stackMm / 2} ${widthMm} ${stackMm}`} overflow="visible" role="img" aria-label={el.text}>
                    {body}
                  </svg>
                  {selected && guides && (
                    <>
                      <button type="button" className={`${styles.resizeHandle} ${styles.resizeHandleX}`} onPointerDown={onResizeDown(el, "x", widthMm, stackMm)} onPointerMove={onResizeMove} onPointerUp={endGesture} onPointerCancel={endGesture} aria-label={`${resizeLabel} ↔`} title={`${resizeLabel} ↔`} />
                      {/* A picture's height is its own. Lettering's is the
                          letters', so a bottom edge would only repeat the
                          corner — taller letters are wider letters. */}
                      {(el.motif || el.artwork) && (
                        <button type="button" className={`${styles.resizeHandle} ${styles.resizeHandleY}`} onPointerDown={onResizeDown(el, "y", widthMm, stackMm)} onPointerMove={onResizeMove} onPointerUp={endGesture} onPointerCancel={endGesture} aria-label={`${resizeLabel} ↕`} title={`${resizeLabel} ↕`} />
                      )}
                      <button type="button" className={`${styles.resizeHandle} ${styles.resizeHandleXY}`} onPointerDown={onResizeDown(el, "xy", widthMm, stackMm)} onPointerMove={onResizeMove} onPointerUp={endGesture} onPointerCancel={endGesture} aria-label={resizeLabel} title={resizeLabel} />
                    </>
                  )}
                  {selected && guides && (
                    <button
                      type="button"
                      className={`${styles.rotateHandle} ${styles.rotateHandleCorner} ${gesture === "rotate" ? styles.rotateHandleActive : ""}`}
                      onPointerDown={onRotateDown(el)}
                      onPointerMove={onRotateMove(el)}
                      onPointerUp={endGesture}
                      onPointerCancel={endGesture}
                      onKeyDown={onRotateKeyDown(el)}
                      aria-label={rotateLabel}
                      title={`${Math.round(((el.rotationDeg % 360) + 360) % 360)}°`}
                    >
                      <RotateCw size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Nothing until the photo has been measured, which is one paint. The
          // flat, non-interactive fallback that used to stand in here is gone
          // with the tracing: every position now has an area, so there is only
          // one way a design is ever drawn.
          null
        )}

        {/* The keystroke sink, mounted for as long as the preview is editable.
            Not only while a lettering box is open: the first tap on one is what
            makes it open, and focus has to land on a node that already exists
            inside that same gesture. Kept in the layout (not `display: none`)
            so it is focusable and in the tab order; clipped to a pixel so it is
            never seen. */}
        {editable && (
          <textarea
            ref={textRef}
            className={styles.inlineTextField}
            value={typingTarget?.raw ?? ""}
            onChange={(e) => {
              if (typingTarget) onTextChange(typingTarget.id, e.target.value);
              setCaretIndex(e.target.selectionStart ?? e.target.value.length);
            }}
            // `select` covers every way a caret moves that is not typing: arrow
            // keys, a click inside the field, Home, End, a drag-select. There is
            // no "caretchange" event, and this is what browsers fire instead.
            onSelect={(e) => setCaretIndex((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
            onFocus={(e) => {
              setTyping(true);
              setCaretIndex(e.target.selectionStart ?? e.target.value.length);
            }}
            onBlur={() => setTyping(false)}
            onKeyDown={(e) => {
              // Escape puts the keyboard away without touching the design; the
              // box keeps the focus ring the layer gives it.
              if (e.key === "Escape") {
                e.preventDefault();
                textRef.current?.blur();
              }
            }}
            aria-label={textLabel}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize={typingTarget?.font.uppercaseOnly ? "characters" : "words"}
            spellCheck={false}
            rows={1}
            /* A far-off rail, not the limit: it stops a pathological paste and
               matches the DTO's own bound. What a position actually holds is
               decided by measuring the design and fitting a hoop round it. */
            maxLength={typingTarget?.contentType === "monogram" ? MONOGRAM_MAX_CHARS + 2 : MAX_TEXT_CHARS}
          />
        )}

        {area && guides && (
          <p className={`${styles.dragHint} ${busy ? styles.dragHintHidden : ""}`} aria-hidden="true">
            <Move size={12} /> {dragHint}
          </p>
        )}
      </div>
    </div>
  );
}
