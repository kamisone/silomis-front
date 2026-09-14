"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Move, RotateCw } from "lucide-react";
import { areaFromQuad, isUsableQuad, type Area, type Point, type Quad } from "@/lib/shop/perspective";
import {
  MAX_TRAVEL_FACTOR, weightForStep, lineWidthMm, clampField,
  type ContentKind, type DesignField, type EditorFont, type EditorPlacement, type EditorThread, type FieldLimits,
} from "@/lib/shop/embroidery";
import styles from "./PersonalizationEditor.module.css";

interface Props {
  imageUrl: string | null;
  productTitle: string;
  placement: EditorPlacement;
  /** The embroidery area the customer sized — the hoop the design runs in. */
  field: DesignField;
  fieldLimits: FieldLimits;
  onFieldChange: (field: DesignField, offset: Point) => void;
  font: EditorFont;
  text: string;
  heightMm: number;
  weightStep: number;
  thread: EditorThread;
  /** The second spool, when the design is outlined. */
  outlineThread: EditorThread | null;
  /** Lines, already normalised. `text` is the same thing joined. */
  lines: string[];
  curveDeg: number;
  trackingPct: number;
  kerning: number[] | null;
  /** Needed to measure a line the same way the validator does. */
  contentType: ContentKind;
  weightStepForWidth?: number;
  /** The chosen shape, drawn instead of lettering. */
  motif: { path: string; viewBox: string; sizeMm: number } | null;
  invalid: boolean;
  /** The area the admin traced on this photo, in % of the image box. */
  quadPct: Quad | null;
  offset: Point;
  onOffsetChange: (offset: Point) => void;
  rotationDeg: number;
  onRotationChange: (deg: number) => void;
  dragHint: string;
  /** Copy for the screen-reader instructions on the draggable design. */
  moveLabel: string;
  rotateLabel: string;
  resizeLabel: string;
  /** False on the review step, where the design is being confirmed, not edited. */
  editable?: boolean;
}

/**
 * The area's handles: which side each one pulls (-1/0/1 per axis), its CSS
 * class, and a word for the screen reader.
 */
const RESIZE_HANDLES: { sx: number; sy: number; cls: string; label: string }[] = [
  { sx: -1, sy: -1, cls: "handleNW", label: "top left" },
  { sx: 0, sy: -1, cls: "handleN", label: "top" },
  { sx: 1, sy: -1, cls: "handleNE", label: "top right" },
  { sx: 1, sy: 0, cls: "handleE", label: "right" },
  { sx: 1, sy: 1, cls: "handleSE", label: "bottom right" },
  { sx: 0, sy: 1, cls: "handleS", label: "bottom" },
  { sx: -1, sy: 1, cls: "handleSW", label: "bottom left" },
  { sx: -1, sy: 0, cls: "handleW", label: "left" },
];

/**
 * The design, drawn onto the product photograph.
 *
 * The artwork's SVG viewBox is the hoop field in millimetres, so a 20mm name
 * occupies exactly 20/55ths of the panel's height — the preview cannot flatter
 * a size that will not fit. Everything else is in the photograph's own pixels:
 * the design moves and turns against the image's axes, so what the customer
 * lines up by eye is what gets stitched.
 */
export default function DesignPreview({
  imageUrl,
  productTitle,
  placement,
  field,
  fieldLimits,
  onFieldChange,
  font,
  text,
  heightMm,
  weightStep,
  thread,
  outlineThread,
  lines,
  curveDeg,
  trackingPct,
  kerning,
  contentType,
  motif,
  invalid,
  quadPct,
  offset,
  onOffsetChange,
  rotationDeg,
  onRotationChange,
  dragHint,
  moveLabel,
  rotateLabel,
  resizeLabel,
  editable = true,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [resizing, setResizing] = useState(false);
  /**
   * Whether the design is "picked up". Its guides — the dotted field and the
   * rotate handle — exist to aim with, and once the aiming is done they are the
   * only thing standing between the customer and a clean look at their cap.
   */
  const [selected, setSelected] = useState(true);

  const drag = useRef<{ startX: number; startY: number; startOffset: Point } | null>(null);
  const spin = useRef<{ startAngle: number; startRotation: number } | null>(null);
  const stretch = useRef<{ startX: number; startY: number; startField: DesignField; startOffset: Point; sx: number; sy: number } | null>(null);

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
  useEffect(() => setSelected(true), [placement.key]);

  const traced = isUsableQuad(quadPct);
  const measured = box.width > 0 && box.height > 0;
  // A traced area whose box has not been measured yet renders neither layer.
  // Showing the flat fallback for one frame and then swapping is a visible jump
  // on every load, and the wait is one paint.
  const awaitingMeasure = traced && !measured;

  const area: Area | null =
    traced && measured
      ? areaFromQuad(quadPct!.map((p) => ({ x: (p.x / 100) * box.width, y: (p.y / 100) * box.height })) as Quad)
      : null;

  /**
   * Two sizes, two jobs. The position's field is the *traced* panel's real
   * size — it converts the photograph's pixels to millimetres and never moves
   * under the customer. The design's field is the area the customer sized,
   * drawn at that scale: widen it and the dotted box grows on the cap by
   * exactly that many millimetres.
   */
  const fieldW = field.widthMm;
  const fieldH = field.heightMm;
  /** Screen pixels per millimetre — the one conversion the whole control needs. */
  const pxPerMm = area ? area.width / placement.fieldWidthMm : 0;
  const layerW = fieldW * pxPerMm;
  const layerH = fieldH * pxPerMm;
  /** Travel is bounded by the position, not by the area — see the server. */
  const travelW = placement.fieldWidthMm;
  const travelH = placement.fieldHeightMm;

  const clampOffset = useCallback(
    (next: Point): Point => {
      // The hoop travels with the lettering, so the bound is how far the hoop
      // may move — the same number the server applies, so the pointer never
      // shows a position add-to-cart would snap back from.
      const maxX = travelW * MAX_TRAVEL_FACTOR;
      const maxY = travelH * MAX_TRAVEL_FACTOR;
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [travelW, travelH],
  );

  // ── Moving ───────────────────────────────────────────────────────────

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      drag.current = { startX: e.clientX, startY: e.clientY, startOffset: offset };
      setDragging(true);
      setSelected(true);
    },
    [offset],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current || !pxPerMm) return;
      const { startX, startY, startOffset } = drag.current;
      // Screen pixels straight to millimetres. The design moves along the
      // image's own axes, so a drag goes exactly where the pointer goes
      // whatever angle the design happens to be turned to.
      onOffsetChange(
        clampOffset({
          x: startOffset.x + (e.clientX - startX) / pxPerMm,
          y: startOffset.y + (e.clientY - startY) / pxPerMm,
        }),
      );
    },
    [onOffsetChange, clampOffset, pxPerMm],
  );

  const endDrag = useCallback(() => {
    drag.current = null;
    setDragging(false);
  }, []);

  /** Arrow keys nudge by a millimetre — the control has to work without a pointer. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
      onOffsetChange(clampOffset({ x: offset.x + d.x, y: offset.y + d.y }));
    },
    [offset, onOffsetChange, clampOffset],
  );

  // ── Resizing the area ────────────────────────────────────────────────

  /**
   * Grows or shrinks the area from one edge or corner, in the design's own
   * axes, keeping the opposite edge where it was.
   *
   * A pointer delta on screen is first turned into the design's frame (the
   * area may be rotated), then into millimetres. Only the pulled side moves,
   * so the centre — which is what `offset` records — shifts by half the
   * change, turned back into the photograph's axes. The result is the edge
   * following the finger and the rest of the design staying put, which is the
   * only behaviour that does not feel like the box is fighting back.
   */
  const applyResize = useCallback(
    (start: NonNullable<typeof stretch.current>, dxPx: number, dyPx: number) => {
      if (!pxPerMm) return;
      const rad = (rotationDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const lx = (dxPx * cos + dyPx * sin) / pxPerMm;
      const ly = (-dxPx * sin + dyPx * cos) / pxPerMm;
      const next = clampField(
        { widthMm: start.startField.widthMm + start.sx * lx, heightMm: start.startField.heightMm + start.sy * ly },
        fieldLimits,
      );
      const dW = next.widthMm - start.startField.widthMm;
      const dH = next.heightMm - start.startField.heightMm;
      const cx = (start.sx * dW) / 2;
      const cy = (start.sy * dH) / 2;
      onFieldChange(
        next,
        clampOffset({
          x: start.startOffset.x + cx * cos - cy * sin,
          y: start.startOffset.y + cx * sin + cy * cos,
        }),
      );
    },
    [pxPerMm, rotationDeg, fieldLimits, onFieldChange, clampOffset],
  );

  const onResizeDown = useCallback(
    (sx: number, sy: number) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      stretch.current = { startX: e.clientX, startY: e.clientY, startField: field, startOffset: offset, sx, sy };
      setResizing(true);
      setSelected(true);
    },
    [field, offset],
  );

  const onResizeMove = useCallback(
    (e: React.PointerEvent) => {
      const start = stretch.current;
      if (!start) return;
      applyResize(start, e.clientX - start.startX, e.clientY - start.startY);
    },
    [applyResize],
  );

  const endResize = useCallback(() => {
    stretch.current = null;
    setResizing(false);
  }, []);

  /** Arrow keys on a handle pull that edge by a millimetre, shift for five. */
  const onResizeKeyDown = useCallback(
    (sx: number, sy: number) => (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 5 : 1;
      // Left/up shrink, right/down grow — whichever edge the handle is on.
      const grow: Record<string, number> = { ArrowRight: step, ArrowDown: step, ArrowLeft: -step, ArrowUp: -step };
      const d = grow[e.key];
      if (d === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
      if ((horizontal && !sx) || (!horizontal && !sy)) return;
      const start = { startX: 0, startY: 0, startField: field, startOffset: offset, sx, sy };
      // Expressed as a pointer delta along the design's own axes, so the same
      // code path serves both and the two can never disagree.
      const rad = (rotationDeg * Math.PI) / 180;
      const mm = d * (horizontal ? sx : sy);
      const lx = horizontal ? mm : 0;
      const ly = horizontal ? 0 : mm;
      applyResize(start, (lx * Math.cos(rad) - ly * Math.sin(rad)) * pxPerMm, (lx * Math.sin(rad) + ly * Math.cos(rad)) * pxPerMm);
    },
    [field, offset, rotationDeg, pxPerMm, applyResize],
  );

  // ── Turning ──────────────────────────────────────────────────────────

  /** The design's centre on screen, which every angle is measured around. */
  const centre: Point | null = area
    ? { x: area.cx + offset.x * pxPerMm, y: area.cy + offset.y * pxPerMm }
    : null;

  const pointerAngle = useCallback(
    (e: React.PointerEvent): number | null => {
      const el = wrapRef.current;
      if (!el || !centre) return null;
      const rect = el.getBoundingClientRect();
      return (Math.atan2(e.clientY - rect.top - centre.y, e.clientX - rect.left - centre.x) * 180) / Math.PI;
    },
    [centre],
  );

  const onRotateDown = useCallback(
    (e: React.PointerEvent) => {
      const angle = pointerAngle(e);
      if (angle === null) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      spin.current = { startAngle: angle, startRotation: rotationDeg };
      setRotating(true);
    },
    [pointerAngle, rotationDeg],
  );

  const onRotateMove = useCallback(
    (e: React.PointerEvent) => {
      if (!spin.current) return;
      const angle = pointerAngle(e);
      if (angle === null) return;
      const next = spin.current.startRotation + (angle - spin.current.startAngle);
      // Shift snaps to 15°, which is what makes a deliberately straight or
      // diagonal design reachable with a pointer at all.
      onRotationChange(e.shiftKey ? Math.round(next / 15) * 15 : Math.round(next * 10) / 10);
    },
    [pointerAngle, onRotationChange],
  );

  const endRotate = useCallback(() => {
    spin.current = null;
    setRotating(false);
  }, []);

  const onRotateKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 15 : 1;
      const delta: Record<string, number> = { ArrowLeft: -step, ArrowRight: step, ArrowDown: -step, ArrowUp: step };
      const d = delta[e.key];
      if (d === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      onRotationChange(Math.round((rotationDeg + d) * 10) / 10);
    },
    [rotationDeg, onRotationChange],
  );

  /**
   * A press anywhere on the photo that is not on the design puts it down.
   *
   * Hit-tests the layer element rather than comparing coordinates: the browser
   * already knows exactly which pixels it covers, and re-deriving that would be
   * a second implementation free to disagree with the first. The rotate handle
   * stops propagation, so it never reaches here.
   */
  const onStagePointerDown = useCallback((e: React.PointerEvent) => {
    const layer = layerRef.current;
    if (layer && e.target instanceof Node && layer.contains(e.target)) return;
    setSelected(false);
  }, []);

  // Cap height is not the em box — 0.72 is the usual ratio, and using it keeps
  // the rendered letters at the millimetre height being quoted.
  const fontSizeMm = heightMm / 0.72;

  /** The arc's chord: what the straight version measures, by the same rule. */
  const estimatedChord = lineWidthMm({
    line: (lines.length ? lines : [text]).reduce((a, b) => (b.length > a.length ? b : a), ""),
    heightMm,
    font,
    contentType,
    weightStep,
    trackingPct,
    kerning,
  });

  /**
   * The handle rides just outside the design's top-right corner, turning with
   * it. Outside rather than on the corner, because the corner itself is now a
   * resize handle and the two must never sit under one finger.
   */
  const handleAt: Point | null = (() => {
    if (!area || !centre) return null;
    const rad = (rotationDeg * Math.PI) / 180;
    const x = layerW / 2 + 24;
    const y = -layerH / 2 - 24;
    return {
      x: centre.x + x * Math.cos(rad) - y * Math.sin(rad),
      y: centre.y + x * Math.sin(rad) + y * Math.cos(rad),
    };
  })();

  // Kept in step with the production sheet's own layout — a preview that
  // stacked or bent its lines differently would be showing a design the
  // machine is not going to make.
  const lead = fontSizeMm * 0.72 * 1.35;
  const rows = lines.length ? lines : [text];
  const firstY = fieldH / 2 - ((rows.length - 1) * lead) / 2;
  const glyphFill = thread.hex;
  const outlineHex = outlineThread?.hex;

  const artwork = (
    <svg
      className={styles.previewSvg}
      viewBox={`0 0 ${fieldW} ${fieldH}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={motif ? "" : text}
    >
      <rect
        className={styles.fieldOutline}
        x={0}
        y={0}
        width={fieldW}
        height={fieldH}
        // Scales with the field so it reads the same on a 25mm strap and a
        // 110mm panel; vector-effect would make it hairline on both.
        strokeWidth={Math.max(fieldW, fieldH) * 0.008}
      />

      {motif ? (
        (() => {
          const [, , vw, vh] = motif.viewBox.split(/\s+/).map(Number);
          const scale = motif.sizeMm / Math.max(vw || 100, vh || 100);
          return (
            <g
              transform={`translate(${fieldW / 2 - ((vw || 100) * scale) / 2} ${fieldH / 2 - ((vh || 100) * scale) / 2}) scale(${scale})`}
            >
              <path d={motif.path} fill={glyphFill} />
            </g>
          );
        })()
      ) : (
        rows.map((line, i) => {
          const y = firstY + i * lead;
          /**
           * Every line is drawn at exactly the width the validator measures.
           *
           * Without this the preview shows the browser's own font metrics
           * while the fit meter measures our model of the embroidery face, and
           * the two disagree by a lot: "Lilli" measures 62mm and draws 40mm in
           * Helvetica, so the guides said it overran while it visibly did not.
           *
           * Forcing the width is also the *more* faithful preview, not a
           * fudge — `webFamily` is explicitly a visual stand-in, and the
           * estimate is our model of the face that will actually be stitched.
           * `spacingAndGlyphs` because a wider or narrower face differs in both.
           */
          const lineMm = lineWidthMm({
            line,
            heightMm,
            font,
            contentType,
            weightStep,
            trackingPct,
            kerning,
          });

          const common = {
            fontFamily: font.webFamily,
            fontSize: fontSizeMm,
            fontWeight: weightForStep(weightStep).cssWeight,
            fill: glyphFill,
            // The outline is a genuine second colour, so it is a stroke in
            // that thread rather than a thicker version of the fill.
            stroke: outlineHex ?? glyphFill,
            strokeWidth: outlineHex ? fontSizeMm * 0.06 : fontSizeMm * 0.012,
            textAnchor: "middle" as const,
            style: { paintOrder: "stroke" as const },
          };

          if (!curveDeg) {
            return (
              <text
                key={i}
                x={fieldW / 2}
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
          const chord = Math.max(1, estimatedChord);
          const half = (Math.abs(curveDeg) * Math.PI) / 360;
          const radius = chord / (2 * Math.sin(half));
          const sweep = curveDeg > 0 ? 1 : 0;
          const dy = curveDeg > 0 ? radius - radius * Math.cos(half) : -(radius - radius * Math.cos(half));
          const id = `pv-arc-${i}`;
          const d =
            `M ${fieldW / 2 - chord / 2} ${y + dy} ` +
            `A ${radius} ${radius} 0 0 ${sweep} ${fieldW / 2 + chord / 2} ${y + dy}`;
          return (
            <g key={i}>
              <path id={id} d={d} fill="none" />
              <text {...common}>
                {/* On a path the length belongs to the textPath, which is what
                    actually lays the glyphs out along the arc. */}
                <textPath href={`#${id}`} startOffset="50%" textLength={lineMm > 0 ? lineMm : undefined} lengthAdjust="spacingAndGlyphs">
                  {line}
                </textPath>
              </text>
            </g>
          );
        })
      )}
    </svg>
  );

  return (
    <div className={styles.previewStage}>
      <div className={styles.previewImageWrap} ref={wrapRef} onPointerDown={editable ? onStagePointerDown : undefined}>
        {imageUrl ? (
          <Image src={imageUrl} alt={productTitle} fill sizes="(max-width: 900px) 100vw, 520px" className={styles.previewImage} priority />
        ) : (
          <div className={styles.previewImageFallback} aria-hidden="true" />
        )}

        {area ? (
          <div
            ref={layerRef}
            role="application"
            aria-label={moveLabel}
            tabIndex={0}
            onFocus={() => setSelected(true)}
            className={`${styles.designLayer} ${dragging ? styles.designLayerDragging : ""} ${invalid ? styles.designLayerInvalid : ""} ${selected && editable ? styles.designLayerSelected : ""} ${resizing ? styles.designLayerResizing : ""}`}
            style={{
              left: area.cx,
              top: area.cy,
              width: layerW,
              height: layerH,
              // Centre on the traced spot, move, then turn — all in the
              // photograph's own axes, so 90° is a true quarter turn and the
              // box's sides stay parallel to the image at every quarter.
              transform: [
                "translate(-50%, -50%)",
                `translate(${offset.x * pxPerMm}px, ${offset.y * pxPerMm}px)`,
                `rotate(${rotationDeg}deg)`,
              ].join(" "),
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
          >
            {artwork}
            {/* Eight handles on the area's own edges, so they turn with it.
                Each pulls one side; the opposite side stays where it is. */}
            {editable &&
              selected &&
              RESIZE_HANDLES.map(({ sx, sy, cls, label }) => (
                <button
                  key={cls}
                  type="button"
                  className={`${styles.resizeHandle} ${styles[cls]}`}
                  aria-label={`${resizeLabel} (${label})`}
                  onPointerDown={onResizeDown(sx, sy)}
                  onPointerMove={onResizeMove}
                  onPointerUp={endResize}
                  onPointerCancel={endResize}
                  onKeyDown={onResizeKeyDown(sx, sy)}
                />
              ))}
            {selected && editable && (
              <span className={styles.sizeTag} aria-hidden="true">
                {Math.round(fieldW)} × {Math.round(fieldH)} mm
              </span>
            )}
          </div>
        ) : awaitingMeasure ? null : (
          // No traced area for this position — fall back to the placement's
          // flat box. Less precise, but it still shows the right size in the
          // right region, which is the part that must never be wrong.
          <div
            className={`${styles.previewField} ${invalid ? styles.previewFieldInvalid : ""}`}
            style={{
              left: `${placement.preview.xPct}%`,
              top: `${placement.preview.yPct}%`,
              width: `${placement.preview.widthPct}%`,
              height: `${placement.preview.heightPct}%`,
              transform: `rotate(${placement.preview.rotateDeg}deg)`,
            }}
          >
            {artwork}
          </div>
        )}

        {area && editable && selected && handleAt && (
          <button
            type="button"
            className={`${styles.rotateHandle} ${rotating ? styles.rotateHandleActive : ""} ${resizing ? styles.rotateHandleHidden : ""}`}
            style={{ left: handleAt.x, top: handleAt.y }}
            onPointerDown={onRotateDown}
            onPointerMove={onRotateMove}
            onPointerUp={endRotate}
            onPointerCancel={endRotate}
            onKeyDown={onRotateKeyDown}
            aria-label={rotateLabel}
            title={`${Math.round(((rotationDeg % 360) + 360) % 360)}°`}
          >
            <RotateCw size={13} aria-hidden="true" />
          </button>
        )}

        {area && editable && selected && (
          <p className={`${styles.dragHint} ${dragging || rotating ? styles.dragHintHidden : ""}`} aria-hidden="true">
            <Move size={12} /> {dragHint}
          </p>
        )}
      </div>
    </div>
  );
}
