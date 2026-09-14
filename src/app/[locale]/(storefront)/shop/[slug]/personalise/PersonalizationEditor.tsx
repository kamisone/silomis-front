"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, Loader2, AlertTriangle, Ruler, Palette, Type, MapPin,
  ShoppingBag, RotateCcw, RotateCw, Plus, Bold, ArrowRight, PencilLine,
  MoveHorizontal, Spline, Sparkles, Undo2, Redo2, Copy, Scaling, Minus, Maximize2,
} from "lucide-react";
import DesignPreview from "./DesignPreview";
import { useCart, type PersonalizationInput } from "@/components/shop/CartContext";
import { getTranslations, type Locale } from "@/lib/i18n";
import {
  evaluate, heightBounds, MONOGRAM_MAX_CHARS, DEFAULT_WEIGHT_STEP, WEIGHT_SCALE, weightForStep,
  DEFAULT_OPTIONS, MAX_TEXT_LINES, TRACKING_MIN, TRACKING_MAX, KERNING_LIMIT, CURVE_LIMIT_DEG,
  MOTIF_MIN_MM, MOTIF_MAX_MM, DEFAULT_FIELD_LIMITS, clampField,
  type ContentKind, type DesignField, type DesignOptions, type EditorConfig, type EditorEvaluation, type EditorPlacement,
  type FieldLimits,
} from "@/lib/shop/embroidery";
import { isUsableQuad, type Point, type Quad } from "@/lib/shop/perspective";
import styles from "./PersonalizationEditor.module.css";

interface Props {
  locale: Locale;
  config: EditorConfig;
  product: { id: string; slug: string; title: string; imageUrl: string | null; basePriceCents: number };
  variant: { id: string; label: string; priceCents: number };
}

const STEPS = ["positions", "design", "review"] as const;
type Step = (typeof STEPS)[number];

/** Letter heights people ask for by name. Filtered to what the face and area allow. */
const SIZE_PRESETS = [10, 15, 20, 25, 30, 40] as const;

/** One-tap angles. Anything between them is the rotate handle's job. */
const QUARTER_TURNS = [0, 90, 180, 270] as const;

/**
 * The angle as a customer reads it: 0–359, never negative.
 *
 * The server folds rotations into (-180, 180] so that 370° and 10° are one
 * design rather than two cart lines. That is the right storage rule and the
 * wrong thing to show — "turned -90°" is arithmetic, "turned 270°" is a
 * three-quarter turn.
 */
function displayAngle(deg: number): number {
  return Math.round(((deg % 360) + 360) % 360);
}

/** Everything the customer chose for one position. */
interface DesignState {
  raw: string;
  fontKey: string;
  threadIds: string[];
  heightMm: number;
  /**
   * The embroidery area — the hoop the design runs in — as the customer sized
   * it. Starts at the position's field and is theirs from then on.
   */
  field: DesignField;
  /** 1 (light) to 5 (extra bold) — how heavily the satin column is laid down. */
  weightStep: number;
  offset: Point;
  /** Angle in the garment's plane; the rotate handle drives it. */
  rotationDeg: number;
  /** Everything the design tools set — kept together so undo can snapshot it. */
  options: DesignOptions;
}

function euros(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * The embroidery editor.
 *
 * Three steps, in the order the constraints cascade: which positions, then
 * what goes on each, then a last look. Positions come first because each one
 * has its own hoop field, and the field is what decides how much text fits and
 * how large it can be — asking for the text first and rejecting it afterwards
 * is the version of this screen people abandon.
 *
 * A customer can embroider several positions at once and pays for each, since
 * each is its own hooping and its own run on the machine. Everything shown —
 * price, stitch count, fit — is computed locally so it moves with the typing,
 * then confirmed by a debounced server quote whose total is the binding one.
 */
export default function PersonalizationEditor({ locale, config, product, variant }: Props) {
  const t = getTranslations(locale);
  const c = t.personalize;
  const { addItem, openDrawer } = useCart();

  const [step, setStep] = useState<Step>("positions");
  const [designs, setDesigns] = useState<Record<string, DesignState>>({});

  /**
   * Undo history over the whole design map.
   *
   * Snapshots rather than inverse operations: a design is small, the edits are
   * many and varied, and writing an undo for each control is where this kind
   * of feature usually goes wrong. Capped so a long session cannot grow
   * without bound.
   */
  const past = useRef<Record<string, DesignState>[]>([]);
  const future = useRef<Record<string, DesignState>[]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  /**
   * The current designs, readable from callbacks and effects without making
   * every one of them depend on the map — the quote effect already re-runs on
   * its own key, and the tools act on whatever is current when they fire.
   */
  const designsRef = useRef<Record<string, DesignState>>({});

  const commit = useCallback((next: Record<string, DesignState>) => {
    setDesigns((prev) => {
      past.current = [...past.current.slice(-49), prev];
      future.current = [];
      return next;
    });
    setHistoryTick((t) => t + 1);
  }, []);

  const undo = useCallback(() => {
    setDesigns((prev) => {
      const last = past.current.pop();
      if (!last) return prev;
      future.current = [prev, ...future.current.slice(0, 49)];
      return last;
    });
    setHistoryTick((t) => t + 1);
  }, []);

  const redo = useCallback(() => {
    setDesigns((prev) => {
      const [next, ...rest] = future.current;
      if (!next) return prev;
      future.current = rest;
      past.current = [...past.current.slice(-49), prev];
      return next;
    });
    setHistoryTick((t) => t + 1);
  }, []);
  const [activeKey, setActiveKey] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const [quote, setQuote] = useState<{ totalCents: number } | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  designsRef.current = designs;

  const chosenKeys = useMemo(
    () => config.placements.filter((p) => designs[p.key]).map((p) => p.key),
    [config.placements, designs],
  );

  const defaultDesign = useCallback(
    (placement: EditorPlacement): DesignState => {
      const font = config.fonts[0];
      return {
        raw: "",
        fontKey: font?.key ?? "",
        threadIds: config.threads[0] ? [config.threads[0].id] : [],
        // Two thirds of the field's height is a flattering default that still
        // leaves room to move, rather than a fixed number that overflows a
        // small position and looks lost on a large one.
        heightMm: Math.max(font?.minHeightMm ?? 8, Math.round(placement.fieldHeightMm * 0.34)),
        field: { widthMm: placement.fieldWidthMm, heightMm: placement.fieldHeightMm },
        weightStep: DEFAULT_WEIGHT_STEP,
        offset: { x: 0, y: 0 },
        rotationDeg: 0,
        options: { ...DEFAULT_OPTIONS, contentType: config.template.allowText ? "text" : "monogram" },
      };
    },
    [config.fonts, config.threads, config.template.allowText],
  );

  const togglePosition = useCallback(
    (placement: EditorPlacement) => {
      commit(
        (() => {
          const next = { ...designsRef.current };
          if (next[placement.key]) delete next[placement.key];
          else next[placement.key] = defaultDesign(placement);
          return next;
        })(),
      );
      setActiveKey((prev) => (prev === placement.key ? "" : placement.key));
    },
    [defaultDesign, commit],
  );

  // Keep the open tab pointing at something that still exists.
  useEffect(() => {
    if (!chosenKeys.length) setActiveKey("");
    else if (!chosenKeys.includes(activeKey)) setActiveKey(chosenKeys[0]);
  }, [chosenKeys, activeKey]);

  const activePlacement = useMemo(
    () => config.placements.find((p) => p.key === activeKey) ?? null,
    [config.placements, activeKey],
  );
  const activeDesign = activeKey ? designs[activeKey] : undefined;

  const patchActive = useCallback(
    (patch: Partial<DesignState>) => {
      if (!activeKey) return;
      setDesigns((prev) => {
        if (!prev[activeKey]) return prev;
        past.current = [...past.current.slice(-49), prev];
        future.current = [];
        return { ...prev, [activeKey]: { ...prev[activeKey], ...patch } };
      });
      setHistoryTick((t) => t + 1);
    },
    [activeKey],
  );

  /** The design tools all live under `options`, so they get their own patcher. */
  const patchOptions = useCallback(
    (patch: Partial<DesignOptions>) => {
      if (!activeKey) return;
      setDesigns((prev) => {
        if (!prev[activeKey]) return prev;
        past.current = [...past.current.slice(-49), prev];
        future.current = [];
        return { ...prev, [activeKey]: { ...prev[activeKey], options: { ...prev[activeKey].options, ...patch } } };
      });
      setHistoryTick((t) => t + 1);
    },
    [activeKey],
  );

  // ── Evaluation, per position ─────────────────────────────────────────

  const evaluations = useMemo(() => {
    const out: Record<string, EditorEvaluation> = {};
    for (const placement of config.placements) {
      const d = designs[placement.key];
      if (!d) continue;
      const font = config.fonts.find((f) => f.key === d.fontKey) ?? config.fonts[0];
      out[placement.key] = evaluate({
        raw: d.raw,
        font,
        placement,
        field: d.field,
        heightMm: d.heightMm,
        colorCount: new Set(d.threadIds).size,
        bands: config.priceBands,
        weightStep: d.weightStep,
        options: d.options,
        threadMultiplier: Math.max(
          1,
          ...d.threadIds.map((id) => config.threads.find((t) => t.id === id)?.priceMultiplier ?? 1),
        ),
      });
    }
    return out;
  }, [config.placements, config.fonts, config.priceBands, designs]);

  const activeFont = useMemo(
    () => config.fonts.find((f) => f.key === activeDesign?.fontKey) ?? config.fonts[0],
    [config.fonts, activeDesign?.fontKey],
  );
  const activeEval = activeKey ? evaluations[activeKey] : undefined;
  const activeThreads = useMemo(
    () => (activeDesign?.threadIds ?? []).map((id) => config.threads.find((th) => th.id === id)).filter(Boolean) as EditorConfig["threads"],
    [config.threads, activeDesign?.threadIds],
  );

  const availableFonts = useMemo(
    () => (activeDesign?.options.contentType === "monogram" ? config.fonts.filter((f) => f.supportsMonogram) : config.fonts),
    [config.fonts, activeDesign?.options.contentType],
  );

  const fieldLimits: FieldLimits = config.fieldLimits ?? DEFAULT_FIELD_LIMITS;

  /** A shape is square, so the smaller side of the area is its ceiling. */
  const motifMax = activeDesign
    ? Math.max(MOTIF_MIN_MM, Math.min(MOTIF_MAX_MM, Math.floor(Math.min(activeDesign.field.heightMm, activeDesign.field.widthMm))))
    : MOTIF_MAX_MM;

  const bounds = useMemo(
    () => (activeFont && activeDesign ? heightBounds(activeFont, activeDesign.field) : { min: 8, max: 40 }),
    [activeFont, activeDesign],
  );

  /**
   * Resizes the open design's area. The offset comes with it because pulling
   * one edge moves the centre by half the change — the preview works that out
   * in the design's own axes, so it is handed back here rather than redone.
   */
  const setField = useCallback(
    (field: DesignField, offset?: Point) => {
      const next = clampField(field, fieldLimits);
      patchActive(offset ? { field: next, offset } : { field: next });
    },
    [fieldLimits, patchActive],
  );

  /** What this shop offers: words, initials, and shapes if any are published. */
  const kinds = useMemo(() => {
    const out: ContentKind[] = [];
    if (config.template.allowText) out.push("text");
    if (config.template.allowMonogram) out.push("monogram");
    if (config.motifs.length) out.push("motif");
    return out;
  }, [config.template.allowText, config.template.allowMonogram, config.motifs.length]);

  // ── Keeping each position's choices internally consistent ────────────

  useEffect(() => {
    if (!activeDesign || !activePlacement) return;
    const patch: Partial<DesignState> = {};
    if (!availableFonts.some((f) => f.key === activeDesign.fontKey)) patch.fontKey = availableFonts[0]?.key;
    const clamped = Math.min(bounds.max, Math.max(bounds.min, activeDesign.heightMm));
    if (clamped !== activeDesign.heightMm) patch.heightMm = clamped;
    if (activeDesign.threadIds.length > activePlacement.maxColors) {
      patch.threadIds = activeDesign.threadIds.slice(0, activePlacement.maxColors);
    }
    if (Object.keys(patch).length) patchActive(patch);
  }, [activeDesign, activePlacement, availableFonts, bounds.min, bounds.max, patchActive]);

  /**
   * Copies another position's design onto the open one.
   *
   * Everything except the placement travels — including where it sits and how
   * it is turned, because "the same as the front" usually means the same in
   * every respect. The consistency effects below then clamp anything the new
   * position's field cannot take, which is why this can be a blunt copy.
   */
  const copyFrom = useCallback(
    (sourceKey: string) => {
      if (!activeKey) return;
      const source = designsRef.current[sourceKey];
      if (!source) return;
      commit({
        ...designsRef.current,
        [activeKey]: { ...source, options: { ...source.options } },
      });
    },
    [activeKey, commit],
  );

  // ── Server quote for the whole set ───────────────────────────────────

  const payload: PersonalizationInput[] = useMemo(
    () =>
      chosenKeys
        .filter((k) => !evaluations[k]?.error)
        .map((k) => ({
          placementKey: k,
          contentType: designs[k].options.contentType,
          text: evaluations[k].text,
          fontKey: designs[k].fontKey,
          heightMm: designs[k].heightMm,
          fieldWidthMm: designs[k].field.widthMm,
          fieldHeightMm: designs[k].field.heightMm,
          weight: designs[k].weightStep,
          threadColorIds: designs[k].threadIds,
          offsetXMm: designs[k].offset.x,
          offsetYMm: designs[k].offset.y,
          rotationDeg: designs[k].rotationDeg,
          trackingPct: designs[k].options.trackingPct,
          kerning: designs[k].options.kerning ?? undefined,
          curveDeg: designs[k].options.curveDeg,
          outline: designs[k].options.outline,
          puff: designs[k].options.puff,
          motifKey: designs[k].options.motifKey ?? undefined,
          motifSizeMm: designs[k].options.motifSizeMm,
        })),
    [chosenKeys, designs, evaluations],
  );

  const quoteKey = JSON.stringify(payload);
  const latestQuote = useRef(0);

  useEffect(() => {
    if (!payload.length || payload.length !== chosenKeys.length) {
      setQuote(null);
      setQuoteState("idle");
      setQuoteError(null);
      return;
    }
    setQuoteState("loading");
    const ticket = ++latestQuote.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/next-api/public/shop/personalization/quote/${product.id}?lang=${locale}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designs: payload }),
        });
        // A stale response must never overwrite a newer one — the customer
        // types faster than the network answers.
        if (ticket !== latestQuote.current) return;
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setQuote(null);
          setQuoteState("error");
          setQuoteError(errorCopy(body?.code, c, body as ErrorDetail, locale) ?? c.errors.generic);
          return;
        }
        setQuote({ totalCents: body.totalCents });
        setQuoteState("ok");
        setQuoteError(null);

        // The server clamps a drag that ran past the hoop's edge. When its
        // answer differs from ours, its answer wins — otherwise the preview
        // keeps showing a position the cart will not store.
        for (const d of body.designs ?? []) {
          const local = designsRef.current[d.placementKey];
          if (!local) continue;
          if (Math.abs(d.offsetXMm - local.offset.x) > 0.15 || Math.abs(d.offsetYMm - local.offset.y) > 0.15) {
            setDesigns((prev) =>
              prev[d.placementKey]
                ? { ...prev, [d.placementKey]: { ...prev[d.placementKey], offset: { x: d.offsetXMm, y: d.offsetYMm } } }
                : prev,
            );
          }
        }
      } catch {
        if (ticket !== latestQuote.current) return;
        setQuoteState("error");
        setQuoteError(c.errors.offline);
      }
    }, 400);
    return () => clearTimeout(timer);
    // quoteKey stands in for every input the quote depends on.
  }, [quoteKey, product.id, locale, c]); // eslint-disable-line react-hooks/exhaustive-deps



  // Any edit invalidates a confirmation given for a different design.
  useEffect(() => setConfirmed(false), [quoteKey]);

  // ── Totals ───────────────────────────────────────────────────────────

  const localTotal = chosenKeys.reduce((sum, k) => sum + (evaluations[k]?.priceCents ?? 0), 0);
  const embroideryCents = quote?.totalCents ?? localTotal;
  const totalCents = variant.priceCents + embroideryCents;

  /**
   * "Nothing written yet" is not a mistake — it is the next thing to do, and on
   * the Positions step the customer has not even been offered a field to write
   * in. Treating it as an error put a red alert on screen the moment a position
   * was ticked, telling someone off for not doing something they had not been
   * asked to do yet. It is tracked separately from anything that is actually
   * wrong, and reported as a nudge rather than a complaint.
   */
  const incompleteKeys = chosenKeys.filter((k) => evaluations[k]?.error === "empty");
  const firstBroken = chosenKeys.find((k) => evaluations[k]?.error && evaluations[k]?.error !== "empty");

  const localError = firstBroken
    ? errorCopyForCode(
        evaluations[firstBroken].error!,
        config.placements.find((p) => p.key === firstBroken)!,
        c,
        chosenKeys.length > 1,
      )
    : null;
  // Errors are only shown where they can be acted on. On the Positions step
  // there is no text field, so a complaint about the text is just noise.
  const blocking = step === "positions" ? null : (localError ?? quoteError);

  // Read through the tick so the buttons re-render when the stacks change —
  // a ref's contents are invisible to React on their own.
  void historyTick;
  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  /** The largest band is the ceiling — past it there is no price to charge. */
  const stitchCeiling = useMemo(
    () => config.priceBands.reduce((max, b) => Math.max(max, b.maxStitches), 0),
    [config.priceBands],
  );
  const stitchFill = activeEval && stitchCeiling ? activeEval.stitches / stitchCeiling : 0;

  const stepIndex = STEPS.indexOf(step);
  const canLeavePositions = chosenKeys.length > 0;
  const canLeaveDesign = chosenKeys.length > 0 && !firstBroken && !incompleteKeys.length;
  const canAdd = !blocking && !incompleteKeys.length && quoteState === "ok" && confirmed && !adding;

  const handleAdd = useCallback(async () => {
    setAdding(true);
    setAddError("");
    const result = await addItem(variant.id, 1, undefined, payload);
    setAdding(false);
    if (result.ok) {
      openDrawer();
      return;
    }
    setAddError(errorCopy(result.code, c, result as ErrorDetail, locale) ?? c.errors.addFailed);
  }, [addItem, variant.id, payload, openDrawer, c, locale]);

  // The preview follows the open tab; with nothing chosen it shows the first
  // position's photo so the page is never a blank rectangle.
  const previewPlacement = activePlacement ?? config.placements[0];
  const previewDesign = activeDesign;
  const previewQuad = (previewPlacement?.corners as Quad | undefined) ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <Link href={`/${locale}/shop/${product.slug}`} className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{c.backToProduct}</span>
        </Link>
        <div className={styles.topTitle}>
          <span className={styles.eyebrow}>{c.eyebrow}</span>
          <h1 className={styles.title}>{product.title}</h1>
        </div>
      </header>

      <div className={styles.layout}>
        {/* ── Preview ────────────────────────────────────────────────── */}
        <section className={styles.previewCol} aria-label={c.previewLabel}>
          <div className={styles.previewSticky}>
            {previewPlacement && (
              <DesignPreview
                imageUrl={previewPlacement.imageUrl}
                productTitle={product.title}
                placement={previewPlacement}
                field={previewDesign?.field ?? { widthMm: previewPlacement.fieldWidthMm, heightMm: previewPlacement.fieldHeightMm }}
                fieldLimits={fieldLimits}
                onFieldChange={(field, offset) => setField(field, offset)}
                font={activeFont}
                text={activeEval?.text || c.previewPlaceholder}
                heightMm={previewDesign?.heightMm ?? 16}
                weightStep={previewDesign?.weightStep ?? DEFAULT_WEIGHT_STEP}
                thread={activeThreads[0] ?? config.threads[0]}
                outlineThread={previewDesign?.options.outline ? (activeThreads[1] ?? null) : null}
                lines={activeEval?.lines ?? []}
                curveDeg={previewDesign?.options.curveDeg ?? 0}
                trackingPct={previewDesign?.options.trackingPct ?? 0}
                kerning={previewDesign?.options.kerning ?? null}
                contentType={previewDesign?.options.contentType ?? "text"}
                motif={
                  previewDesign?.options.contentType === "motif" && previewDesign.options.motifKey
                    ? (() => {
                        const m = config.motifs.find((x) => x.key === previewDesign.options.motifKey);
                        return m ? { path: m.path, viewBox: m.viewBox, sizeMm: previewDesign.options.motifSizeMm } : null;
                      })()
                    : null
                }
                invalid={!!activeEval?.error}
                quadPct={isUsableQuad(previewQuad) ? previewQuad : null}
                offset={previewDesign?.offset ?? { x: 0, y: 0 }}
                onOffsetChange={(offset) => patchActive({ offset })}
                rotationDeg={previewDesign?.rotationDeg ?? 0}
                onRotationChange={(rotationDeg) => patchActive({ rotationDeg })}
                dragHint={c.dragHint}
                moveLabel={c.moveLabel}
                rotateLabel={c.rotateLabel}
                resizeLabel={c.resizeLabel}
                // Positions and Your design are for editing; Review is for
                // confirming, so the handles come off there.
                editable={step !== "review"}
              />
            )}

            {chosenKeys.length > 1 && (
              <div className={styles.angleRow} role="tablist" aria-label={c.angleLabel}>
                {chosenKeys.map((k) => {
                  const p = config.placements.find((pl) => pl.key === k)!;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={k === activeKey}
                      className={`${styles.angleBtn} ${k === activeKey ? styles.angleBtnActive : ""} ${evaluations[k]?.error ? styles.angleBtnError : ""}`}
                      onClick={() => setActiveKey(k)}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}

            {activeEval && activePlacement && (
              <>
                <div className={styles.fitRow}>
                  <div className={styles.fitMeter} role="img" aria-label={c.fitLabel}>
                    <div
                      className={`${styles.fitFill} ${activeEval.widthFill > 0.99 ? styles.fitFillOver : ""}`}
                      style={{ width: `${Math.min(100, activeEval.widthFill * 100)}%` }}
                    />
                  </div>
                  <span className={styles.fitText}>
                    {Math.round(activeEval.widthMm)} / {Math.round(activeDesign?.field.widthMm ?? activePlacement.fieldWidthMm)} mm
                  </span>
                </div>

                {/* The other limit, and the one that surprises people: a bold
                    outlined name can take a fifth of the panel and still be
                    three times the stitches. Without a meter the ceiling only
                    ever announces itself as a rejection. */}
                <div className={styles.fitRow}>
                  <div className={styles.fitMeter} role="img" aria-label={c.budgetLabel}>
                    <div
                      className={`${styles.fitFill} ${stitchFill > 0.99 ? styles.fitFillOver : ""}`}
                      style={{ width: `${Math.min(100, stitchFill * 100)}%` }}
                    />
                  </div>
                  <span className={styles.fitText}>
                    {activeEval.stitches.toLocaleString(locale)} / {stitchCeiling.toLocaleString(locale)}
                  </span>
                </div>

                {isUsableQuad(previewQuad) && previewDesign && (
                  <div className={styles.orientationRow}>
                    {/* Quarter turns of the design. Labelled by angle rather
                        than by a word: "across" and "down" only mean anything
                        relative to how the panel was photographed, while 90°
                        means the same thing on every product and needs no
                        translating. */}
                    <div className={styles.orientRow} role="radiogroup" aria-label={c.orientationTitle}>
                      {QUARTER_TURNS.map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          role="radio"
                          aria-checked={displayAngle(previewDesign.rotationDeg) === deg}
                          className={`${styles.orientBtn} ${displayAngle(previewDesign.rotationDeg) === deg ? styles.orientBtnActive : ""}`}
                          onClick={() => patchActive({ rotationDeg: deg })}
                          title={c.orientationTitle}
                        >
                          <RotateCw size={12} aria-hidden="true" style={{ transform: `rotate(${deg}deg)` }} />
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isUsableQuad(previewQuad) && previewDesign && (
                  <div className={styles.positionRow}>
                    <span className={styles.positionText}>
                      {previewDesign.offset.x === 0 && previewDesign.offset.y === 0
                        ? c.positionCentred
                        : c.positionOffset
                            .replace("{x}", previewDesign.offset.x.toFixed(1))
                            .replace("{y}", previewDesign.offset.y.toFixed(1))}
                      {previewDesign.rotationDeg !== 0 &&
                        ` · ${c.positionRotated.replace("{deg}", String(displayAngle(previewDesign.rotationDeg)))}`}
                    </span>
                    <button
                      type="button"
                      className={styles.recentreBtn}
                      onClick={() => patchActive({ offset: { x: 0, y: 0 }, rotationDeg: 0 })}
                      disabled={
                        previewDesign.offset.x === 0 && previewDesign.offset.y === 0 && previewDesign.rotationDeg === 0
                      }
                    >
                      <RotateCcw size={12} aria-hidden="true" /> {c.recentre}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── Controls ───────────────────────────────────────────────── */}
        <section className={styles.controlCol}>
          <ol className={styles.stepRail} aria-label={c.stepsLabel}>
            {STEPS.map((s, i) => (
              <li key={s} className={styles.stepRailItem}>
                <button
                  type="button"
                  className={`${styles.stepDot} ${i === stepIndex ? styles.stepDotActive : ""} ${i < stepIndex ? styles.stepDotDone : ""}`}
                  onClick={() => (i <= stepIndex ? setStep(s) : undefined)}
                  disabled={i > stepIndex}
                  aria-current={i === stepIndex ? "step" : undefined}
                >
                  <span className={styles.stepNum}>{i < stepIndex ? <Check size={13} aria-hidden="true" /> : i + 1}</span>
                  <span className={styles.stepName}>{c.steps[s]}</span>
                </button>
              </li>
            ))}
          </ol>

          {step === "positions" && (
            <fieldset className={styles.panel}>
              <legend className={styles.panelTitle}>
                <MapPin size={15} aria-hidden="true" /> {c.positionsTitle}
              </legend>
              <p className={styles.panelHint}>{c.positionsHint}</p>
              <div className={styles.optionCards}>
                {config.placements.map((p) => {
                  const chosen = !!designs[p.key];
                  return (
                    <button
                      key={p.key}
                      type="button"
                      className={`${styles.optionCard} ${chosen ? styles.optionCardActive : ""}`}
                      onClick={() => togglePosition(p)}
                      aria-pressed={chosen}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl} alt="" className={styles.optionCardThumb} />
                      <span className={styles.optionCardBody}>
                        <span className={styles.optionCardTitle}>{p.label}</span>
                        {p.hint && <span className={styles.optionCardHint}>{p.hint}</span>}
                        <span className={styles.optionCardMeta}>
                          {c.areaSize
                            .replace("{w}", String(Math.round(designs[p.key]?.field.widthMm ?? p.fieldWidthMm)))
                            .replace("{h}", String(Math.round(designs[p.key]?.field.heightMm ?? p.fieldHeightMm)))}{" "}
                          · {c.upToChars.replace("{n}", String(p.maxChars))}
                        </span>
                      </span>
                      <span className={styles.optionCardRight}>
                        {p.priceCents > 0 && <span className={styles.optionCardPrice}>+€{euros(p.priceCents)}</span>}
                        <span className={`${styles.optionCardCheck} ${chosen ? styles.optionCardCheckOn : ""}`} aria-hidden="true">
                          {chosen ? <Check size={13} /> : <Plus size={13} />}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {chosenKeys.length > 1 && <p className={styles.multiNote}>{c.multiNote}</p>}
            </fieldset>
          )}

          {/* The area is sized here as well as on the design step: how big
              the embroidery is on the cap is a placement decision as much as
              a lettering one, and the handles on the photo already invite it. */}
          {step === "positions" && activePlacement && activeDesign && activeEval && (
            <AreaPanel
              c={c}
              field={activeDesign.field}
              limits={fieldLimits}
              placement={activePlacement}
              evaluation={activeEval}
              onChange={(field) => setField(field)}
            />
          )}

          {step === "design" && activePlacement && activeDesign && activeEval && (
            <>
              {/* Tools, not settings: they act on whatever is open rather than
                  describing it, so they sit above the panels and not inside
                  one. */}
              <div className={styles.toolRow}>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={undo}
                  disabled={!canUndo}
                  title={c.undo}
                >
                  <Undo2 size={14} aria-hidden="true" /> {c.undo}
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={redo}
                  disabled={!canRedo}
                  title={c.redo}
                >
                  <Redo2 size={14} aria-hidden="true" /> {c.redo}
                </button>

                {/* Only worth offering when there is another position to copy
                    from — and setting up the second one is exactly when
                    redoing all of it by hand is most annoying. */}
                {chosenKeys.length > 1 && (
                  <div className={styles.copyFrom}>
                    <span className={styles.copyFromLabel}>
                      <Copy size={13} aria-hidden="true" /> {c.copyFrom}
                    </span>
                    {chosenKeys
                      .filter((k) => k !== activeKey)
                      .map((k) => (
                        <button key={k} type="button" className={styles.toolBtn} onClick={() => copyFrom(k)}>
                          {config.placements.find((p) => p.key === k)?.label ?? k}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {chosenKeys.length > 1 && (
                <div className={styles.designTabs} role="tablist" aria-label={c.positionsTitle}>
                  {chosenKeys.map((k) => {
                    const p = config.placements.find((pl) => pl.key === k)!;
                    const done = !evaluations[k]?.error;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={k === activeKey}
                        className={`${styles.designTab} ${k === activeKey ? styles.designTabActive : ""}`}
                        onClick={() => setActiveKey(k)}
                      >
                        <span className={`${styles.designTabDot} ${done ? styles.designTabDotDone : ""}`} aria-hidden="true" />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <fieldset className={styles.panel}>
                <legend className={styles.panelTitle}>
                  <Type size={15} aria-hidden="true" /> {c.contentTitle}
                </legend>

                <div className={styles.segmented} role="tablist" aria-label={c.contentTitle}>
                  {kinds.map((ct) => (
                    <button
                      key={ct}
                      type="button"
                      role="tab"
                      aria-selected={activeDesign.options.contentType === ct}
                      className={`${styles.segment} ${activeDesign.options.contentType === ct ? styles.segmentActive : ""}`}
                      onClick={() => patchOptions({ contentType: ct })}
                    >
                      {c.contentTypes[ct]}
                    </button>
                  ))}
                </div>

                {activeDesign.options.contentType === "motif" ? (
                  <>
                    <span className={styles.fieldLabel}>{c.motifTitle}</span>
                    <div className={styles.motifGrid}>
                      {config.motifs.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          className={`${styles.motifCard} ${activeDesign.options.motifKey === m.key ? styles.motifCardActive : ""}`}
                          onClick={() => patchOptions({ motifKey: m.key })}
                          aria-pressed={activeDesign.options.motifKey === m.key}
                          title={m.name}
                        >
                          {/* The catalogue is admin-authored, so the path goes
                              on a `d` attribute — never injected as markup. */}
                          <svg viewBox={m.viewBox} className={styles.motifSvg} aria-hidden="true">
                            <path d={m.path} fill="currentColor" />
                          </svg>
                          <span className={styles.motifName}>{m.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <label className={styles.fieldLabel} htmlFor="personalize-text">
                      {activeDesign.options.contentType === "monogram" ? c.monogramLabel : c.textLabel}
                    </label>
                    {/* A textarea, because a design can be several lines. It
                        grows with them rather than scrolling — there are at
                        most three, and a scrollbar would hide one. */}
                    <textarea
                      id="personalize-text"
                      className={`${styles.textInput} ${activeEval.error && activeDesign.raw ? styles.textInputError : ""}`}
                      value={activeDesign.raw}
                      onChange={(e) => patchActive({ raw: e.target.value })}
                      placeholder={activeDesign.options.contentType === "monogram" ? c.monogramPlaceholder : c.textPlaceholder}
                      rows={Math.min(MAX_TEXT_LINES, Math.max(1, activeEval.lines.length))}
                      maxLength={
                        activeDesign.options.contentType === "monogram"
                          ? MONOGRAM_MAX_CHARS + 2
                          : (activePlacement.maxChars + 4) * MAX_TEXT_LINES
                      }
                      autoComplete="off"
                      autoCapitalize={activeFont.uppercaseOnly ? "characters" : "words"}
                      spellCheck={false}
                      style={{ fontFamily: activeFont.webFamily, fontWeight: weightForStep(activeDesign.weightStep).cssWeight }}
                      aria-describedby="personalize-text-help"
                    />
                    <div className={styles.fieldFooter} id="personalize-text-help">
                      <span className={styles.charCount}>
                        {activeEval.lines.reduce((n, l) => Math.max(n, l.length), 0)} /{" "}
                        {activeDesign.options.contentType === "monogram" ? MONOGRAM_MAX_CHARS : activePlacement.maxChars}
                      </span>
                      <span className={styles.fieldNote}>
                        {activeDesign.options.contentType === "monogram"
                          ? c.monogramNote
                          : c.linesHint.replace("{n}", String(MAX_TEXT_LINES))}
                      </span>
                    </div>
                  </>
                )}
              </fieldset>

              <fieldset className={styles.panel}>
                <legend className={styles.panelTitle}>
                  <Type size={15} aria-hidden="true" /> {c.fontTitle}
                </legend>
                <div className={styles.fontGrid}>
                  {availableFonts.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      className={`${styles.fontCard} ${f.key === activeFont.key ? styles.fontCardActive : ""}`}
                      onClick={() => patchActive({ fontKey: f.key })}
                      aria-pressed={f.key === activeFont.key}
                    >
                      <span className={styles.fontSample} style={{ fontFamily: f.webFamily }}>
                        {activeEval.text.slice(0, 8) || c.fontSample}
                      </span>
                      <span className={styles.fontName}>{f.name}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Size sits right under the face: pick the letters, then how
                  big. A slider for feel, a typed field for "exactly 25". */}
              <fieldset className={styles.panel}>
                <legend className={styles.panelTitle}>
                  <Ruler size={15} aria-hidden="true" />{" "}
                  {activeDesign.options.contentType === "motif" ? c.motifSizeTitle : c.sizeTitle}
                </legend>
                <p className={styles.panelHint}>{c.sizeHint}</p>
                {activeDesign.options.contentType === "motif" ? (
                  <>
                    <div className={styles.sliderRow}>
                      <input
                        type="range"
                        className={styles.slider}
                        min={MOTIF_MIN_MM}
                        max={motifMax}
                        step={1}
                        value={activeDesign.options.motifSizeMm}
                        onChange={(e) => patchOptions({ motifSizeMm: Number(e.target.value) })}
                        aria-label={c.motifSizeTitle}
                      />
                      <Stepper
                        label={c.motifSizeTitle}
                        compact
                        value={activeDesign.options.motifSizeMm}
                        min={MOTIF_MIN_MM}
                        max={motifMax}
                        onChange={(motifSizeMm) => patchOptions({ motifSizeMm })}
                      />
                    </div>
                    <div className={styles.sliderScale} aria-hidden="true">
                      <span>{MOTIF_MIN_MM} mm</span>
                      <span>{motifMax} mm</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.sliderRow}>
                      <input
                        type="range"
                        className={styles.slider}
                        min={bounds.min}
                        max={bounds.max}
                        step={1}
                        value={activeDesign.heightMm}
                        onChange={(e) => patchActive({ heightMm: Number(e.target.value) })}
                        aria-label={c.sizeTitle}
                      />
                      <Stepper
                        label={c.sizeTitle}
                        compact
                        value={activeDesign.heightMm}
                        min={bounds.min}
                        max={bounds.max}
                        onChange={(heightMm) => patchActive({ heightMm })}
                      />
                    </div>
                    <div className={styles.sliderScale} aria-hidden="true">
                      <span>{bounds.min} mm</span>
                      <span>{bounds.max} mm</span>
                    </div>
                    {/* The sizes people actually ask for, one tap away. Only
                        those the face and the area allow are offered. */}
                    <div className={styles.sizePresets} role="group" aria-label={c.sizeTitle}>
                      {SIZE_PRESETS.filter((mm) => mm >= bounds.min && mm <= bounds.max).map((mm) => (
                        <button
                          key={mm}
                          type="button"
                          className={`${styles.sizePreset} ${activeDesign.heightMm === mm ? styles.sizePresetActive : ""}`}
                          onClick={() => patchActive({ heightMm: mm })}
                          aria-pressed={activeDesign.heightMm === mm}
                        >
                          {mm}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </fieldset>

              <fieldset className={styles.panel}>
                <legend className={styles.panelTitle}>
                  <Bold size={15} aria-hidden="true" /> {c.weightTitle}
                </legend>
                <p className={styles.panelHint}>{c.weightHint}</p>
                <div className={styles.weightRow} role="radiogroup" aria-label={c.weightTitle}>
                  {WEIGHT_SCALE.map((w) => (
                    <button
                      key={w.step}
                      type="button"
                      role="radio"
                      aria-checked={activeDesign.weightStep === w.step}
                      className={`${styles.weightBtn} ${activeDesign.weightStep === w.step ? styles.weightBtnActive : ""}`}
                      onClick={() => patchActive({ weightStep: w.step })}
                    >
                      {/* Each step previews itself in the customer's own text
                          and their chosen face — an abstract "Bold" label says
                          nothing about how a script will actually thicken. */}
                      <span
                        className={styles.weightSample}
                        style={{ fontFamily: activeFont.webFamily, fontWeight: w.cssWeight }}
                      >
                        {activeEval.text.slice(0, 5) || c.fontSample}
                      </span>
                      <span className={styles.weightName}>{c.weightLabels[w.step - 1]}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className={styles.panel}>
                <legend className={styles.panelTitle}>
                  <Palette size={15} aria-hidden="true" /> {c.threadTitle}
                </legend>
                <p className={styles.panelHint}>{c.threadHint.replace("{n}", String(activePlacement.maxColors))}</p>
                <div className={styles.swatchGrid}>
                  {config.threads.map((th) => {
                    const index = activeDesign.threadIds.indexOf(th.id);
                    return (
                      <button
                        key={th.id}
                        type="button"
                        className={`${styles.swatch} ${index >= 0 ? styles.swatchActive : ""}`}
                        style={{ ["--swatch" as string]: th.hex }}
                        onClick={() => {
                          const ids = activeDesign.threadIds;
                          if (ids.includes(th.id)) {
                            // Never leave a design with no colour at all.
                            if (ids.length > 1) patchActive({ threadIds: ids.filter((id) => id !== th.id) });
                            return;
                          }
                          // At the limit the newest pick replaces the last one
                          // rather than being ignored — a dead tap reads as the
                          // page being broken.
                          patchActive({
                            threadIds:
                              ids.length >= activePlacement.maxColors ? [...ids.slice(0, -1), th.id] : [...ids, th.id],
                          });
                        }}
                        aria-pressed={index >= 0}
                        title={`${th.name} · ${th.brand} ${th.code}`}
                      >
                        <span className={styles.swatchChip} aria-hidden="true" />
                        {index >= 0 && <span className={styles.swatchOrder}>{index + 1}</span>}
                        <span className={styles.srOnly}>{th.name}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {activeDesign.options.contentType !== "motif" && (
                <>
                  <fieldset className={styles.panel}>
                    <legend className={styles.panelTitle}>
                      <MoveHorizontal size={15} aria-hidden="true" /> {c.spacingTitle}
                    </legend>
                    <div className={styles.sliderRow}>
                      <input
                        type="range"
                        className={styles.slider}
                        min={TRACKING_MIN * 100}
                        max={TRACKING_MAX * 100}
                        step={1}
                        value={Math.round(activeDesign.options.trackingPct * 100)}
                        onChange={(e) => patchOptions({ trackingPct: Number(e.target.value) / 100 })}
                        aria-label={c.trackingLabel}
                      />
                      <output className={styles.sliderValue}>
                        {activeDesign.options.trackingPct > 0 ? "+" : ""}
                        {Math.round(activeDesign.options.trackingPct * 100)}%
                      </output>
                    </div>

                    {/* Kerning is per gap, so it only appears once there are
                        gaps to nudge — and it is folded away, because most
                        customers will never need it. */}
                    {activeEval.lines.length === 1 && activeEval.lines[0].length > 1 && (
                      <details className={styles.kerning}>
                        <summary className={styles.kerningSummary}>{c.kerningLabel}</summary>
                        <p className={styles.panelHint}>{c.kerningHint}</p>
                        <div className={styles.kerningRow}>
                          {[...activeEval.lines[0]].slice(0, -1).map((ch, i) => (
                            <label key={i} className={styles.kerningGap}>
                              <span className={styles.kerningPair} style={{ fontFamily: activeFont.webFamily }}>
                                {ch}
                                {activeEval.lines[0][i + 1]}
                              </span>
                              <input
                                type="range"
                                className={styles.kerningSlider}
                                min={-KERNING_LIMIT * 100}
                                max={KERNING_LIMIT * 100}
                                step={2}
                                value={Math.round((activeDesign.options.kerning?.[i] ?? 0) * 100)}
                                onChange={(e) => {
                                  const gaps = activeEval.lines[0].length - 1;
                                  const next = Array.from({ length: gaps }, (_, g) => activeDesign.options.kerning?.[g] ?? 0);
                                  next[i] = Number(e.target.value) / 100;
                                  patchOptions({ kerning: next });
                                }}
                                aria-label={`${ch}${activeEval.lines[0][i + 1]}`}
                              />
                            </label>
                          ))}
                        </div>
                        <button type="button" className={styles.recentreBtn} onClick={() => patchOptions({ kerning: null })}>
                          {c.kerningReset}
                        </button>
                      </details>
                    )}
                  </fieldset>

                  {activeFont.supportsCurve && (
                    <fieldset className={styles.panel}>
                      <legend className={styles.panelTitle}>
                        <Spline size={15} aria-hidden="true" /> {c.curveTitle}
                      </legend>
                      <p className={styles.panelHint}>{c.curveHint}</p>
                      <div className={styles.sliderRow}>
                        <input
                          type="range"
                          className={styles.slider}
                          min={-CURVE_LIMIT_DEG}
                          max={CURVE_LIMIT_DEG}
                          step={5}
                          value={activeDesign.options.curveDeg}
                          onChange={(e) => patchOptions({ curveDeg: Number(e.target.value) })}
                          aria-label={c.curveTitle}
                        />
                        <output className={styles.sliderValue}>
                          {activeDesign.options.curveDeg === 0 ? c.curveStraight : `${activeDesign.options.curveDeg}°`}
                        </output>
                      </div>
                    </fieldset>
                  )}

                  <fieldset className={styles.panel}>
                    <legend className={styles.panelTitle}>
                      <Sparkles size={15} aria-hidden="true" /> {c.finishTitle}
                    </legend>

                    <label className={`${styles.switchRow} ${activeDesign.threadIds.length < 2 ? styles.switchRowOff : ""}`}>
                      <input
                        type="checkbox"
                        checked={activeDesign.options.outline}
                        disabled={activeDesign.threadIds.length < 2}
                        onChange={(e) => patchOptions({ outline: e.target.checked })}
                      />
                      <span>
                        {c.outlineLabel}
                        {activeDesign.threadIds.length < 2 && (
                          <span className={styles.switchNote}>{c.outlineNeedsTwo}</span>
                        )}
                      </span>
                    </label>

                    {/* Puff is gated by the position AND the face: foam needs a
                        flat frame and wide columns, and a fine script collapses
                        over it. Shown disabled with the reason rather than
                        hidden, so the option is discoverable. */}
                    <label
                      className={`${styles.switchRow} ${
                        !activePlacement.allowPuff || !activeFont.supportsPuff ? styles.switchRowOff : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={activeDesign.options.puff}
                        disabled={!activePlacement.allowPuff || !activeFont.supportsPuff}
                        onChange={(e) => patchOptions({ puff: e.target.checked })}
                      />
                      <span>
                        {c.puffLabel}
                        {(!activePlacement.allowPuff || !activeFont.supportsPuff) && (
                          <span className={styles.switchNote}>{c.puffUnavailable}</span>
                        )}
                      </span>
                    </label>
                  </fieldset>
                </>
              )}

              <AreaPanel
                c={c}
                field={activeDesign.field}
                limits={fieldLimits}
                placement={activePlacement}
                evaluation={activeEval}
                onChange={(field) => setField(field)}
              />

            </>
          )}

          {step === "review" && (
            <fieldset className={styles.panel}>
              <legend className={styles.panelTitle}>
                <Check size={15} aria-hidden="true" /> {c.reviewTitle}
              </legend>

              <p className={styles.spellCheckLabel}>{c.spellCheckLabel}</p>
              {chosenKeys.map((k) => {
                const p = config.placements.find((pl) => pl.key === k)!;
                const d = designs[k];
                const e = evaluations[k];
                const font = config.fonts.find((f) => f.key === d.fontKey) ?? config.fonts[0];
                const threads = d.threadIds.map((id) => config.threads.find((th) => th.id === id)).filter(Boolean);
                return (
                  <div key={k} className={styles.reviewCard}>
                    <div className={styles.reviewHead}>
                      <span className={styles.reviewPlacement}>{p.label}</span>
                      <span className={styles.reviewPrice}>€{euros(e.priceCents ?? 0)}</span>
                    </div>
                    {/* Set large and in the chosen face: the whole point of this
                        step is that a typo is visible, and a typo in 13px body
                        copy is not. */}
                    <strong
                      className={styles.spellCheckText}
                      style={{
                        fontFamily: font.webFamily,
                        fontWeight: weightForStep(d.weightStep).cssWeight,
                        color: threads[0]?.hex,
                      }}
                    >
                      {e.text}
                    </strong>
                    <p className={styles.reviewMeta}>
                      {font.name} · {c.weightLabels[d.weightStep - 1]} · {d.heightMm} mm ·{" "}
                      {threads.map((th) => th!.name).join(", ")} ·{" "}
                      {c.areaSize.replace("{w}", String(Math.round(d.field.widthMm))).replace("{h}", String(Math.round(d.field.heightMm)))}
                      {d.rotationDeg !== 0 && ` · ${displayAngle(d.rotationDeg)}°`}
                    </p>
                    <button
                      type="button"
                      className={styles.reviewEdit}
                      onClick={() => {
                        setActiveKey(k);
                        setStep("design");
                      }}
                    >
                      {c.edit}
                    </button>
                  </div>
                );
              })}

              <dl className={styles.summary}>
                <div>
                  <dt>{c.summaryItem}</dt>
                  <dd>
                    {product.title} — {variant.label}
                  </dd>
                </div>
                <div>
                  <dt>{c.summaryPositions}</dt>
                  <dd>{chosenKeys.length}</dd>
                </div>
                <div>
                  <dt>{c.summaryEmbroidery}</dt>
                  <dd>€{euros(embroideryCents)}</dd>
                </div>
              </dl>

              <label className={styles.consent}>
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span>{c.consent}</span>
              </label>
              <p className={styles.consentNote}>{c.consentNote}</p>

              {addError && (
                <p className={styles.errorBox} role="alert">
                  <AlertTriangle size={14} aria-hidden="true" /> {addError}
                </p>
              )}
            </fieldset>
          )}

          {/* What to do next, not what went wrong. Named after the button it
              points at, so the two can never drift apart. */}
          {step === "positions" && chosenKeys.length > 0 && (
            <p className={styles.noteBox}>
              <ArrowRight size={14} aria-hidden="true" />
              {c.nextAddText.replace("{action}", c.continue)}
            </p>
          )}

          {step === "design" && incompleteKeys.length > 0 && (
            <p className={styles.noteBox}>
              <PencilLine size={14} aria-hidden="true" />
              {c.needsText.replace(
                "{list}",
                incompleteKeys.map((k) => config.placements.find((p) => p.key === k)?.label ?? k).join(", "),
              )}
            </p>
          )}

          {blocking && (
            <p className={styles.errorBox} role="alert">
              <AlertTriangle size={14} aria-hidden="true" /> {blocking}
            </p>
          )}
        </section>
      </div>

      {/* ── Action bar ───────────────────────────────────────────────── */}
      <div className={styles.actionBar}>
        <div className={styles.priceBlock}>
          <span className={styles.priceLabel}>
            {c.priceLabel}
            {quoteState === "loading" && <Loader2 size={12} className={styles.spin} aria-hidden="true" />}
          </span>
          <span className={styles.priceValue}>€{euros(totalCents)}</span>
          {embroideryCents > 0 && (
            <span className={styles.priceBreakdown}>
              {c.includesEmbroidery.replace("{price}", `€${euros(embroideryCents)}`)}
              {chosenKeys.length > 1 && ` · ${c.acrossPositions.replace("{n}", String(chosenKeys.length))}`}
            </span>
          )}
        </div>

        <div className={styles.actions}>
          {stepIndex > 0 && (
            <button type="button" className={styles.secondaryBtn} onClick={() => setStep(STEPS[stepIndex - 1])}>
              {c.back}
            </button>
          )}
          {step !== "review" ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => setStep(STEPS[stepIndex + 1])}
              disabled={step === "positions" ? !canLeavePositions : !canLeaveDesign}
            >
              {c.continue}
            </button>
          ) : (
            <button type="button" className={styles.primaryBtn} onClick={handleAdd} disabled={!canAdd}>
              {adding ? <Loader2 size={15} className={styles.spin} aria-hidden="true" /> : <ShoppingBag size={15} aria-hidden="true" />}
              {adding ? c.adding : c.addToCart}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Error copy ─────────────────────────────────────────────────────────
// The backend returns codes rather than sentences precisely so the copy can
// live here, translated, next to the control that caused it.

type Copy = ReturnType<typeof getTranslations>["personalize"];

function errorCopyForCode(code: string, placement: EditorPlacement, c: Copy, namePosition: boolean): string {
  // Only worth naming the position when there is more than one to confuse it
  // with — otherwise every message starts with a word that adds nothing.
  const where = (msg: string) => (namePosition ? `${placement.label}: ${msg}` : msg);
  switch (code) {
    // No `empty` case: nothing written yet is handled as a nudge, not an error.
    case "tooLong":
      return where(c.errors.tooLong.replace("{n}", String(placement.maxChars)));
    case "unstitchable":
      return where(c.errors.unstitchable);
    case "monogramLength":
      return where(c.errors.monogramLength);
    case "tooWide":
      return where(c.errors.tooWide);
    case "tooTall":
      return where(c.errors.tooTall);
    case "tooManyLines":
      return where(c.errors.tooManyLines.replace("{n}", String(MAX_TEXT_LINES)));
    case "outlineNeedsSecondColor":
      return where(c.errors.outlineNeedsSecondColor);
    case "tooManyColors":
      return where(c.errors.tooManyColors.replace("{n}", String(placement.maxColors)));
    case "tooManyStitches":
      return where(c.errors.tooManyStitches);
    // (the detailed version, with counts and a suggestion, comes from the
    //  server's own reply — see errorCopy below)
    default:
      return where(c.errors.generic);
  }
}

/** The server's reply for a rejected design, when it carried detail. */
interface ErrorDetail {
  stitchEstimate?: number;
  maxStitches?: number;
  relax?: "outline" | "puff" | "weight" | "curve" | null;
}

function errorCopy(code: string | undefined, c: Copy, detail?: ErrorDetail, locale?: string): string | null {
  switch (code) {
    case "PERSONALIZATION_TEXT_EMPTY":
      return c.errors.empty;
    case "PERSONALIZATION_TEXT_TOO_LONG":
      return c.errors.tooLongGeneric;
    case "PERSONALIZATION_TEXT_UNSTITCHABLE":
      return c.errors.unstitchable;
    case "PERSONALIZATION_TEXT_BLOCKED":
      return c.errors.blocked;
    case "PERSONALIZATION_MONOGRAM_LENGTH":
      return c.errors.monogramLength;
    case "PERSONALIZATION_HEIGHT_OUT_OF_RANGE":
      return c.errors.heightRange;
    case "PERSONALIZATION_TOO_WIDE":
      return c.errors.tooWide;
    case "PERSONALIZATION_TOO_MANY_COLORS":
      return c.errors.tooManyColorsGeneric;
    case "PERSONALIZATION_TOO_MANY_STITCHES": {
      // Counts and a way out, rather than "too large": the ceiling is machine
      // time, and the customer cannot see it without being told the numbers.
      const base =
        detail?.stitchEstimate && detail?.maxStitches
          ? c.errors.tooManyStitches
              .replace("{n}", detail.stitchEstimate.toLocaleString(locale))
              .replace("{max}", detail.maxStitches.toLocaleString(locale))
          : c.errors.tooManyStitches.replace("{n}", "—").replace("{max}", "—");
      const hint =
        detail?.relax === "outline"
          ? c.relaxOutline
          : detail?.relax === "puff"
            ? c.relaxPuff
            : detail?.relax === "weight"
              ? c.relaxWeight
              : detail?.relax === "curve"
                ? c.relaxCurve
                : null;
      return hint ? `${base} ${hint}` : base;
    }
    case "PERSONALIZATION_TOO_TALL":
      return c.errors.tooTall;
    case "PERSONALIZATION_TOO_MANY_LINES":
      return c.errors.tooManyLines.replace("{n}", String(MAX_TEXT_LINES));
    case "PERSONALIZATION_OUTLINE_NEEDS_SECOND_COLOR":
      return c.errors.outlineNeedsSecondColor;
    case "PERSONALIZATION_PUFF_UNAVAILABLE":
      return c.puffUnavailable;
    case "PERSONALIZATION_CURVE_UNAVAILABLE":
      return c.errors.unavailable;
    case "PERSONALIZATION_MOTIF_UNKNOWN":
    case "PERSONALIZATION_MOTIF_SIZE":
      return c.errors.unavailable;
    case "PERSONALIZATION_NOT_AVAILABLE":
    case "PERSONALIZATION_PLACEMENT_UNKNOWN":
    case "PERSONALIZATION_FONT_UNKNOWN":
    case "PERSONALIZATION_THREAD_UNKNOWN":
      return c.errors.unavailable;
    case "INSUFFICIENT_STOCK":
      return c.errors.outOfStock;
    default:
      return null;
  }
}

/**
 * The embroidery area's size, as numbers.
 *
 * The handles on the photo are the natural way to size it; this is the exact
 * way, and the only way on a keyboard. "Fit to text" is the shortcut most
 * people want — wrap the area round what they wrote, with a margin the hoop
 * needs — and Reset is the way back to the position's own default.
 */
function AreaPanel({
  c,
  field,
  limits,
  placement,
  evaluation,
  onChange,
}: {
  c: ReturnType<typeof getTranslations>["personalize"];
  field: DesignField;
  limits: FieldLimits;
  placement: EditorPlacement;
  evaluation: EditorEvaluation;
  onChange: (field: DesignField) => void;
}) {
  const isDefault = field.widthMm === placement.fieldWidthMm && field.heightMm === placement.fieldHeightMm;
  // A hoop wants clearance round the stitching: a tenth, and never under 4mm.
  const fitted = clampField(
    {
      widthMm: Math.ceil(evaluation.widthMm * 1.1 + 4),
      heightMm: Math.ceil(evaluation.stackMm * 1.1 + 4),
    },
    limits,
  );
  const canFit = evaluation.widthMm > 0 && (fitted.widthMm !== field.widthMm || fitted.heightMm !== field.heightMm);

  return (
    <fieldset className={styles.panel}>
      <legend className={styles.panelTitle}>
        <Scaling size={15} aria-hidden="true" /> {c.areaTitle}
      </legend>
      <p className={styles.panelHint}>{c.areaHint}</p>
      <div className={styles.areaGrid}>
        <Stepper
          label={c.areaWidth}
          value={field.widthMm}
          min={limits.minMm}
          max={limits.maxWidthMm}
          onChange={(widthMm) => onChange({ ...field, widthMm })}
        />
        <Stepper
          label={c.areaHeight}
          value={field.heightMm}
          min={limits.minMm}
          max={limits.maxHeightMm}
          onChange={(heightMm) => onChange({ ...field, heightMm })}
        />
      </div>
      <div className={styles.areaActions}>
        <button type="button" className={styles.toolBtn} onClick={() => onChange(fitted)} disabled={!canFit}>
          <Maximize2 size={13} aria-hidden="true" /> {c.areaFit}
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => onChange({ widthMm: placement.fieldWidthMm, heightMm: placement.fieldHeightMm })}
          disabled={isDefault}
        >
          <RotateCcw size={13} aria-hidden="true" /> {c.areaReset}
        </button>
        <span className={styles.areaLimits}>
          {c.areaLimits
            .replace(/\{min\}/g, String(limits.minMm))
            .replace("{maxW}", String(limits.maxWidthMm))
            .replace("{maxH}", String(limits.maxHeightMm))}
        </span>
      </div>
    </fieldset>
  );
}

/**
 * A millimetre field with a button either side. Typing commits on blur or
 * Enter so "1" of "120" never lands as a 1mm area; the buttons commit at once.
 */
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  compact = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** No visible label — for sitting beside a slider that already has one. */
  compact?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(Math.round(value));
  const commit = () => {
    const n = Number(draft);
    if (draft !== null && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };
  const nudge = (d: number) => onChange(Math.min(max, Math.max(min, Math.round(value + d))));

  return (
    <label className={`${styles.stepper} ${compact ? styles.stepperCompact : ""}`}>
      {!compact && <span className={styles.stepperLabel}>{label}</span>}
      <span className={styles.stepperRow}>
        <button type="button" className={styles.stepperBtn} onClick={() => nudge(-1)} disabled={value <= min} aria-label={`${label} −1`}>
          <Minus size={13} aria-hidden="true" />
        </button>
        <input
          className={styles.stepperInput}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={1}
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          aria-label={label}
        />
        <span className={styles.stepperUnit}>mm</span>
        <button type="button" className={styles.stepperBtn} onClick={() => nudge(1)} disabled={value >= max} aria-label={`${label} +1`}>
          <Plus size={13} aria-hidden="true" />
        </button>
      </span>
    </label>
  );
}
