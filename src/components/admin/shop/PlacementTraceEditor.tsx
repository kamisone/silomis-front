"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { areaFromQuad, quadToUnit, isUsableQuad, defaultQuad, type Point, type Quad } from "@/lib/shop/perspective";
import styles from "./PlacementTraceEditor.module.css";

interface Props {
  imageUrl: string;
  /** Corners in % of the image box, TL/TR/BR/BL, or null for "not traced yet". */
  quad: Quad | null;
  onChange: (quad: Quad) => void;
  /** Hoop field in millimetres — sets the sample text's true proportions. */
  fieldWidthMm: number;
  fieldHeightMm: number;
  sampleText: string;
  sampleFontFamily: string;
  disabled?: boolean;
}

const CORNER_LABELS = ["Top left", "Top right", "Bottom right", "Bottom left"];

/**
 * Traces one position's hoop field onto the photograph that shows it.
 *
 * Four corners rather than a box, because a cap panel is essentially never
 * square to the lens — and four points are exactly what a perspective
 * transform needs. The sample text inside is rendered through that same
 * transform, so what the admin lines up here is precisely what a customer will
 * see, rather than a guide that only approximates it.
 *
 * All coordinates are percentages of the image box, so a tracing survives a
 * different rendered size and any later re-crop of the same framing.
 */
export default function PlacementTraceEditor({
  imageUrl,
  quad,
  onChange,
  fieldWidthMm,
  fieldHeightMm,
  sampleText,
  sampleFontFamily,
  disabled,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const panRef = useRef<{ start: Point; quad: Quad } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const current = quad ?? defaultQuad();

  /** Pointer position as a percentage of the image box, clamped to it. */
  const toPct = useCallback((e: React.PointerEvent): Point | null => {
    const el = wrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  const moveCorner = useCallback(
    (index: number, p: Point) => onChange(current.map((c, i) => (i === index ? p : c)) as Quad),
    [current, onChange],
  );

  const onCornerDown = useCallback(
    (index: number) => (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDragIndex(index);
    },
    [disabled],
  );

  const onSurfaceDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      const p = toPct(e);
      if (!p) return;
      // Only start a pan from inside the quad, so a click on bare photo does
      // not drag the shape out from under the pointer.
      const unit = quadToUnit(current, p);
      if (!unit || unit.x < 0 || unit.x > 1 || unit.y < 0 || unit.y > 1) return;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      panRef.current = { start: p, quad: current };
    },
    [disabled, toPct, current],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const p = toPct(e);
      if (!p) return;
      if (dragIndex !== null) {
        moveCorner(dragIndex, p);
        return;
      }
      const pan = panRef.current;
      if (!pan) return;
      const dx = p.x - pan.start.x;
      const dy = p.y - pan.start.y;
      onChange(pan.quad.map((c) => ({ x: c.x + dx, y: c.y + dy })) as Quad);
    },
    [toPct, dragIndex, moveCorner, onChange],
  );

  const endDrag = useCallback(() => {
    setDragIndex(null);
    panRef.current = null;
  }, []);

  /** Arrow keys move a focused corner — the tool has to work without a pointer. */
  const onCornerKeyDown = useCallback(
    (index: number) => (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 1 : 0.2;
      const delta: Record<string, Point> = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
      };
      const d = delta[e.key];
      if (!d) return;
      e.preventDefault();
      const c = current[index];
      moveCorner(index, { x: Math.min(100, Math.max(0, c.x + d.x)), y: Math.min(100, Math.max(0, c.y + d.y)) });
    },
    [current, moveCorner],
  );

  const quadPx: Quad | null =
    box.width && box.height
      ? (current.map((p) => ({ x: (p.x / 100) * box.width, y: (p.y / 100) * box.height })) as Quad)
      : null;

  const usable = isUsableQuad(current);
  // The sample is drawn the way the storefront draws it — upright, sized and
  // centred from the tracing. Showing it skewed onto the corners here would be
  // lining the admin up against something a customer never sees.
  const area = quadPx && usable ? areaFromQuad(quadPx) : null;

  return (
    <div className={styles.editor}>
      <div
        ref={wrapRef}
        className={styles.stage}
        onPointerDown={onSurfaceDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className={styles.image} draggable={false} />

        {/* Drawn in the image's own percentage space, so it needs no transform
            of its own and cannot drift from the handles. */}
        <svg className={styles.overlay} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon
            points={current.map((p) => `${p.x},${p.y}`).join(" ")}
            className={usable ? styles.quadShape : styles.quadShapeInvalid}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {area && (
          <div
            className={styles.sample}
            style={{
              left: area.cx,
              top: area.cy,
              width: area.width,
              height: area.height,
              transform: "translate(-50%, -50%)",
            }}
            aria-hidden="true"
          >
            <svg viewBox={`0 0 ${fieldWidthMm} ${fieldHeightMm}`} preserveAspectRatio="none" className={styles.sampleSvg}>
              <text
                x={fieldWidthMm / 2}
                y={fieldHeightMm / 2}
                fontFamily={sampleFontFamily}
                fontSize={fieldHeightMm * 0.55}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth={fieldHeightMm * 0.012}
                style={{ paintOrder: "stroke" }}
              >
                {sampleText}
              </text>
            </svg>
          </div>
        )}

        {current.map((p, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.handle} ${dragIndex === i ? styles.handleActive : ""}`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            onPointerDown={onCornerDown(i)}
            onKeyDown={onCornerKeyDown(i)}
            aria-label={`${CORNER_LABELS[i]} corner`}
            disabled={disabled}
          >
            <span className={styles.handleDot} aria-hidden="true" />
          </button>
        ))}
      </div>

      <p className={styles.help}>
        Drag the four corners around the embroidery area, or drag inside the shape to move the whole thing. The
        corners set where the embroidery sits and how big it can be; the design itself is always drawn upright, as the
        sample shows. Arrow keys nudge a focused corner.
        {!usable && <strong className={styles.helpWarn}> This shape has collapsed — spread the corners apart.</strong>}
      </p>
    </div>
  );
}
