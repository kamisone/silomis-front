"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Move, RotateCw } from "lucide-react";
import { areaFromQuad, isUsableQuad, type Area, type Point, type Quad } from "@/lib/shop/perspective";
import {
  MAX_TRAVEL_FACTOR, LINE_LEADING, weightForStep, lineWidthMm,
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
  motif: { path: string; viewBox: string; sizeMm: number; heightMm: number; paths?: { d: string; fill: string }[] | null } | null;
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
  onElementChange: (id: string, patch: { offset?: Point; rotationDeg?: number; size?: { widthMm: number; heightMm: number } }) => void;
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
  onElementChange,
  placeholder,
  logoPlaceholder = "Logo",
  quadPct,
  dragHint,
  moveLabel,
  rotateLabel,
  resizeLabel = "Resize",
  editable = true,
}: Props) {
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

  /** Screen pixels per millimetre — the traced panel's real size is the scale. */
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

  // ── Moving a box ─────────────────────────────────────────────────────

  const onElementDown = useCallback(
    (el: PreviewElement) => (e: React.PointerEvent) => {
      e.stopPropagation();
      onSelectElement(el.id);
      setShowGuides(true);
      if (!editable) return;
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
    elementDrag.current = null;
    spin.current = null;
    stretch.current = null;
    setDraggingId(null);
    setGesture("none");
  }, []);

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

  const onResizeDown = useCallback(
    (el: PreviewElement, axis: "x" | "y" | "xy") => (e: React.PointerEvent) => {
      if (!el.motif && !el.artwork) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const w = el.motif ? el.motif.sizeMm : el.artwork!.widthMm;
      const h = el.motif ? el.motif.heightMm : el.artwork!.heightMm;
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
      onElementChange(st.id, { size: { widthMm: Math.max(5, round1(widthMm)), heightMm: Math.max(5, round1(heightMm)) } });
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
    const rows = el.lines.length ? el.lines : [el.text || placeholder];
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
              {el.motif.paths?.length ? el.motif.paths.map((sp, i) => <path key={i} d={sp.d} fill={sp.fill} />) : <path d={el.motif.path} fill={fill} />}
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
              <text key={i} x={0} y={y} dominantBaseline="central" textLength={lineMm > 0 ? lineMm : undefined} lengthAdjust="spacingAndGlyphs" {...common}>
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

    return { widthMm, stackMm, body };
  };

  const active = elements.find((el) => el.id === activeElementId) ?? null;

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
                  role="button"
                  aria-label={`${moveLabel} — ${el.text || (el.artwork ? "logo" : el.motif ? "motif" : placeholder)}`}
                  aria-pressed={selected}
                  tabIndex={editable ? 0 : -1}
                  className={[
                    styles.elementLayer,
                    selected && guides ? styles.elementLayerSelected : "",
                    el.invalid ? styles.elementLayerInvalid : "",
                    draggingId === el.id ? styles.elementLayerDragging : "",
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
                  onPointerDown={onElementDown(el)}
                  onPointerMove={onElementMove}
                  onPointerUp={endGesture}
                  onPointerCancel={endGesture}
                  onKeyDown={onElementKeyDown(el)}
                  onFocus={() => onSelectElement(el.id)}
                >
                  <svg className={styles.elementSvg} viewBox={`${-widthMm / 2} ${-stackMm / 2} ${widthMm} ${stackMm}`} overflow="visible" role="img" aria-label={el.text}>
                    {body}
                  </svg>
                  {selected && guides && (el.motif || el.artwork) && (
                    <>
                      <button type="button" className={`${styles.resizeHandle} ${styles.resizeHandleX}`} onPointerDown={onResizeDown(el, "x")} onPointerMove={onResizeMove} onPointerUp={endGesture} onPointerCancel={endGesture} aria-label={`${resizeLabel} ↔`} title={`${resizeLabel} ↔`} />
                      <button type="button" className={`${styles.resizeHandle} ${styles.resizeHandleY}`} onPointerDown={onResizeDown(el, "y")} onPointerMove={onResizeMove} onPointerUp={endGesture} onPointerCancel={endGesture} aria-label={`${resizeLabel} ↕`} title={`${resizeLabel} ↕`} />
                      <button type="button" className={`${styles.resizeHandle} ${styles.resizeHandleXY}`} onPointerDown={onResizeDown(el, "xy")} onPointerMove={onResizeMove} onPointerUp={endGesture} onPointerCancel={endGesture} aria-label={resizeLabel} title={resizeLabel} />
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
        ) : awaitingMeasure ? null : (
          // No traced area for this position — fall back to the placement's
          // flat box. Less precise, but it still shows the right size in the
          // right region, which is the part that must never be wrong.
          <div
            className={`${styles.previewField} ${active?.invalid ? styles.previewFieldInvalid : ""}`}
            style={{
              left: `${placement.preview.xPct}%`,
              top: `${placement.preview.yPct}%`,
              width: `${placement.preview.widthPct}%`,
              height: `${placement.preview.heightPct}%`,
              transform: `rotate(${placement.preview.rotateDeg}deg)`,
            }}
          >
            <svg
              className={styles.previewSvg}
              viewBox={`${-placement.fieldWidthMm / 2} ${-placement.fieldHeightMm / 2} ${placement.fieldWidthMm} ${placement.fieldHeightMm}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {elements.map((el) => (
                <g key={el.id} transform={`translate(${el.offset.x} ${el.offset.y}) rotate(${el.rotationDeg})`}>
                  {drawElement(el).body}
                </g>
              ))}
            </svg>
          </div>
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
