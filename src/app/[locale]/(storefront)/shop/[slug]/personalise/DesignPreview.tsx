"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Move, RotateCw } from "lucide-react";
import { areaFromQuad, isUsableQuad, type Area, type Point, type Quad } from "@/lib/shop/perspective";
import { MAX_TRAVEL_FACTOR, weightForStep, type EditorFont, type EditorPlacement, type EditorThread } from "@/lib/shop/embroidery";
import styles from "./PersonalizationEditor.module.css";

interface Props {
  imageUrl: string | null;
  productTitle: string;
  placement: EditorPlacement;
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
  /** False on the review step, where the design is being confirmed, not edited. */
  editable?: boolean;
}

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
  editable = true,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [rotating, setRotating] = useState(false);
  /**
   * Whether the design is "picked up". Its guides — the dotted field and the
   * rotate handle — exist to aim with, and once the aiming is done they are the
   * only thing standing between the customer and a clean look at their cap.
   */
  const [selected, setSelected] = useState(true);

  const drag = useRef<{ startX: number; startY: number; startOffset: Point } | null>(null);
  const spin = useRef<{ startAngle: number; startRotation: number } | null>(null);

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

  const fieldW = placement.fieldWidthMm;
  const fieldH = placement.fieldHeightMm;
  /** Screen pixels per millimetre — the one conversion the whole control needs. */
  const pxPerMm = area ? area.width / fieldW : 0;

  const clampOffset = useCallback(
    (next: Point): Point => {
      // The hoop travels with the lettering, so the bound is how far the hoop
      // may move — the same number the server applies, so the pointer never
      // shows a position add-to-cart would snap back from.
      const maxX = fieldW * MAX_TRAVEL_FACTOR;
      const maxY = fieldH * MAX_TRAVEL_FACTOR;
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [fieldW, fieldH],
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

  /** What the straight version would have measured — the arc's chord. */
  const estimatedChord = (() => {
    const longest = (lines.length ? lines : [text]).reduce((a, b) => (b.length > a.length ? b : a), "");
    const advances = [...longest].reduce((sum, ch) => sum + (ch === " " ? 0.5 : 1), 0);
    const gaps = Math.max(0, longest.length - 1);
    const kernSum = kerning ? kerning.reduce((sum, k) => sum + k, 0) : 0;
    return advances * heightMm * font.avgCharWidthRatio + (gaps * trackingPct + kernSum) * heightMm;
  })();

  /** The handle rides the design's top-right corner, turning with it. */
  const handleAt: Point | null = (() => {
    if (!area || !centre) return null;
    const rad = (rotationDeg * Math.PI) / 180;
    const x = area.width / 2;
    const y = -area.height / 2;
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
            letterSpacing: trackingPct ? trackingPct * heightMm : undefined,
            style: { paintOrder: "stroke" as const },
          };

          if (!curveDeg) {
            return (
              <text key={i} x={fieldW / 2} y={y} dominantBaseline="central" {...common}>
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
                <textPath href={`#${id}`} startOffset="50%">
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
            className={`${styles.designLayer} ${dragging ? styles.designLayerDragging : ""} ${invalid ? styles.designLayerInvalid : ""} ${selected && editable ? styles.designLayerSelected : ""}`}
            style={{
              left: area.cx,
              top: area.cy,
              width: area.width,
              height: area.height,
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
            className={`${styles.rotateHandle} ${rotating ? styles.rotateHandleActive : ""}`}
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
