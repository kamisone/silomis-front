"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, Loader2, AlertTriangle, Ruler, Palette, Type, MapPin,
  ShoppingBag, RotateCcw, RotateCw, Plus, Bold, ArrowRight, PencilLine,
  MoveHorizontal, Spline, Sparkles, Undo2, Redo2, Copy, Minus, LayoutList, X, StickyNote,
} from "lucide-react";
import DesignPreview, { type PreviewElement } from "./DesignPreview";
import { useCart, type CustomerItemInput, type PersonalizationInput } from "@/components/shop/CartContext";
import { getTranslations, type Locale } from "@/lib/i18n";
import {
  evaluateDesign, heightBounds, MONOGRAM_MAX_CHARS, DEFAULT_WEIGHT_STEP, WEIGHT_SCALE, weightForStep,
  DEFAULT_OPTIONS, MAX_TEXT_LINES, TRACKING_MIN, TRACKING_MAX, KERNING_LIMIT, CURVE_LIMIT_DEG,
  MOTIF_MIN_MM, MOTIF_MAX_MM, DEFAULT_FIELD_LIMITS, MAX_ELEMENTS,
  type ContentKind, type DesignOptions, type EditorConfig, type EditorEvaluation, type EditorPlacement,
} from "@/lib/shop/embroidery";
import { isUsableQuad, type Point, type Quad } from "@/lib/shop/perspective";
import styles from "./PersonalizationEditor.module.css";

interface Props {
  locale: Locale;
  config: EditorConfig;
  product: { id: string; slug: string; title: string; imageUrl: string | null; basePriceCents: number };
  variant: { id: string; label: string; priceCents: number };
  /**
   * A send-in design: the customer's own item, photographed side by side.
   * One entry per position (a side each); every side is chosen for them and
   * the Positions step is skipped — there is nothing to pick, and every side
   * they photographed has to carry a design.
   */
  customerItems?: Record<string, CustomerItemInput>;
  /** Where "back" leads — the product by default, the previous wizard step for a send-in. */
  back?: { href?: string; label: string; onClick?: () => void };
  /**
   * Steps a wizard walked before handing over here (a send-in's "Your item"),
   * shown as done on the rail so the whole journey reads as one.
   */
  precedingSteps?: { label: string; onClick: () => void }[];
  /**
   * A free-text field the host wants on the design step — a send-in's note
   * to the shop. Rendered as the last panel, after the design itself.
   */
  noteField?: { title: string; hint: string; placeholder: string; value: string; onChange: (value: string) => void; maxLength?: number };
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

/** One box: its own words, face, size, spool, and place in the area. */
interface ElementState {
  id: string;
  raw: string;
  fontKey: string;
  /** The one spool this box is sewn in. */
  threadId: string;
  heightMm: number;
  /** 1 (light) to 5 (extra bold) — how heavily the satin column is laid down. */
  weightStep: number;
  /** From the position's traced centre, in millimetres. */
  offset: Point;
  /** The box's own angle in the garment's plane; the rotate handle drives it. */
  rotationDeg: number;
  /** Everything the design tools set — kept together so undo can snapshot it. */
  options: DesignOptions;
}

/**
 * Everything the customer chose for one position: the boxes, and which one
 * the controls act on. There is no frame to size — the hoop is fitted round
 * the boxes on the server.
 */
interface DesignState {
  elements: ElementState[];
  /** The box the controls act on. */
  activeElementId: string;
}

let elementSeq = 0;
/** Stable across renders and unique across positions — a React key and the preview's handle. */
function nextElementId(): string {
  elementSeq += 1;
  return `b${Date.now().toString(36)}${elementSeq}`;
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
export default function PersonalizationEditor({ locale, config, product, variant, customerItems, back, precedingSteps = [], noteField }: Props) {
  const t = getTranslations(locale);
  const c = t.personalize;
  const { addItem, openDrawer } = useCart();

  // A send-in's positions are its photographed sides and they are already
  // decided, so the editor opens on the design itself.
  const locked = !!customerItems;
  const [step, setStep] = useState<Step>(locked ? "design" : "positions");
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

  /** A fresh box: first face, first spool, a flattering size for the panel. */
  const newElement = useCallback(
    (placement: EditorPlacement): ElementState => {
      const font = config.fonts[0];
      // A third of the traced panel's height is a flattering default that
      // still leaves room to move, rather than a fixed number that overflows
      // a strap and looks lost on a front panel.
      const heightMm = Math.min(font?.maxHeightMm ?? 40, Math.max(font?.minHeightMm ?? 8, Math.round(placement.fieldHeightMm * 0.34)));
      return {
        id: nextElementId(),
        raw: "",
        fontKey: font?.key ?? "",
        threadId: config.threads[0]?.id ?? "",
        heightMm,
        weightStep: DEFAULT_WEIGHT_STEP,
        // Every new box starts at the traced centre — the one spot that is
        // always on the photograph, whatever the position's shape. It is the
        // open box, drawn on top and framed, so it can be picked up at once
        // and dragged where it belongs.
        offset: { x: 0, y: 0 },
        rotationDeg: 0,
        options: { ...DEFAULT_OPTIONS, contentType: config.template.allowText ? "text" : "monogram" },
      };
    },
    [config.fonts, config.threads, config.template.allowText],
  );

  const defaultDesign = useCallback(
    (placement: EditorPlacement): DesignState => {
      const first = newElement(placement);
      return { elements: [first], activeElementId: first.id };
    },
    [newElement],
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

  // A send-in design starts with every side chosen: each photographed side
  // is charged and has to be designed.
  useEffect(() => {
    if (!locked || Object.keys(designsRef.current).length || !config.placements.length) return;
    commit(Object.fromEntries(config.placements.map((p) => [p.key, defaultDesign(p)])));
    setActiveKey(config.placements[0].key);
  }, [locked, config.placements, defaultDesign, commit]);

  const activePlacement = useMemo(
    () => config.placements.find((p) => p.key === activeKey) ?? null,
    [config.placements, activeKey],
  );
  const activeDesign = activeKey ? designs[activeKey] : undefined;

  const activeElementId = activeDesign?.activeElementId ?? "";

  /** Patches the open box of the open position. */
  const patchElement = useCallback(
    (patch: Partial<ElementState>, elementId?: string) => {
      if (!activeKey) return;
      setDesigns((prev) => {
        const d = prev[activeKey];
        if (!d) return prev;
        const id = elementId ?? d.activeElementId;
        past.current = [...past.current.slice(-49), prev];
        future.current = [];
        return { ...prev, [activeKey]: { ...d, elements: d.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)) } };
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
        const d = prev[activeKey];
        if (!d) return prev;
        past.current = [...past.current.slice(-49), prev];
        future.current = [];
        return {
          ...prev,
          [activeKey]: {
            ...d,
            elements: d.elements.map((el) => (el.id === d.activeElementId ? { ...el, options: { ...el.options, ...patch } } : el)),
          },
        };
      });
      setHistoryTick((t) => t + 1);
    },
    [activeKey],
  );

  /** Which box the controls act on. Not an edit, so it is not in the undo history. */
  const selectElement = useCallback(
    (id: string) => {
      if (!activeKey) return;
      setDesigns((prev) => (prev[activeKey] && prev[activeKey].activeElementId !== id ? { ...prev, [activeKey]: { ...prev[activeKey], activeElementId: id } } : prev));
    },
    [activeKey],
  );

  const addElement = useCallback(() => {
    if (!activeKey) return;
    const d = designsRef.current[activeKey];
    if (!d || d.elements.length >= MAX_ELEMENTS) return;
    const placement = config.placements.find((p) => p.key === activeKey);
    if (!placement) return;
    const el = newElement(placement);
    commit({ ...designsRef.current, [activeKey]: { ...d, elements: [...d.elements, el], activeElementId: el.id } });
  }, [activeKey, newElement, commit, config.placements]);

  /** Removes a box. The last one stays: an empty hoop is not a design. */
  const removeElement = useCallback(
    (id: string) => {
      if (!activeKey) return;
      const d = designsRef.current[activeKey];
      if (!d || d.elements.length <= 1) return;
      const idx = d.elements.findIndex((el) => el.id === id);
      const elements = d.elements.filter((el) => el.id !== id);
      const nextActive = d.activeElementId === id ? elements[Math.max(0, idx - 1)].id : d.activeElementId;
      commit({ ...designsRef.current, [activeKey]: { ...d, elements, activeElementId: nextActive } });
    },
    [activeKey, commit],
  );

  // ── Evaluation, per position ─────────────────────────────────────────

  const evaluations = useMemo(() => {
    const out: Record<string, EditorEvaluation> = {};
    for (const placement of config.placements) {
      const d = designs[placement.key];
      if (!d) continue;
      out[placement.key] = evaluateDesign({
        elements: d.elements.map((el) => ({
          raw: el.raw,
          font: config.fonts.find((f) => f.key === el.fontKey) ?? config.fonts[0],
          heightMm: el.heightMm,
          weightStep: el.weightStep,
          options: el.options,
          thread: config.threads.find((t) => t.id === el.threadId),
          offset: el.offset,
          rotationDeg: el.rotationDeg,
        })),
        placement,
        limits: config.fieldLimits ?? DEFAULT_FIELD_LIMITS,
        bands: config.priceBands,
      });
    }
    return out;
  }, [config.placements, config.fonts, config.threads, config.priceBands, config.fieldLimits, designs]);

  const activeElement = useMemo(
    () => activeDesign?.elements.find((el) => el.id === activeDesign.activeElementId) ?? activeDesign?.elements[0],
    [activeDesign],
  );
  const activeElementIndex = activeDesign && activeElement ? activeDesign.elements.indexOf(activeElement) : -1;

  const activeFont = useMemo(
    () => config.fonts.find((f) => f.key === activeElement?.fontKey) ?? config.fonts[0],
    [config.fonts, activeElement?.fontKey],
  );
  const activeEval = activeKey ? evaluations[activeKey] : undefined;
  /** The open box, measured. */
  const activeElementEval = activeEval && activeElementIndex >= 0 ? activeEval.elements[activeElementIndex] : undefined;
  const activeThread = useMemo(
    () => config.threads.find((th) => th.id === activeElement?.threadId) ?? config.threads[0],
    [config.threads, activeElement?.threadId],
  );

  const availableFonts = useMemo(
    () => (activeElement?.options.contentType === "monogram" ? config.fonts.filter((f) => f.supportsMonogram) : config.fonts),
    [config.fonts, activeElement?.options.contentType],
  );

  const motifMax = MOTIF_MAX_MM;

  const bounds = useMemo(() => (activeFont ? heightBounds(activeFont) : { min: 8, max: 40 }), [activeFont]);

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
    if (!activeDesign || !activeElement) return;
    const patch: Partial<ElementState> = {};
    if (!availableFonts.some((f) => f.key === activeElement.fontKey)) patch.fontKey = availableFonts[0]?.key;
    const clamped = Math.min(bounds.max, Math.max(bounds.min, activeElement.heightMm));
    if (clamped !== activeElement.heightMm) patch.heightMm = clamped;
    if (!config.threads.some((t) => t.id === activeElement.threadId)) patch.threadId = config.threads[0]?.id ?? "";
    if (Object.keys(patch).length) patchElement(patch);
  }, [activeDesign, activeElement, availableFonts, bounds.min, bounds.max, config.threads, patchElement]);

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
      // Fresh ids: two positions must never share a box's handle.
      const elements = source.elements.map((el) => ({ ...el, id: nextElementId(), options: { ...el.options } }));
      commit({
        ...designsRef.current,
        [activeKey]: { ...source, elements, activeElementId: elements[0].id },
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
          ...(customerItems?.[k] ? { customerItem: customerItems[k] } : {}),
          elements: designs[k].elements.map((el, i) => ({
            contentType: el.options.contentType,
            text: evaluations[k].elements[i]?.text ?? "",
            fontKey: el.fontKey,
            heightMm: el.heightMm,
            threadColorId: el.threadId,
            weight: el.weightStep,
            offsetXMm: el.offset.x,
            offsetYMm: el.offset.y,
            rotationDeg: el.rotationDeg,
            trackingPct: el.options.trackingPct,
            kerning: el.options.kerning ?? undefined,
            curveDeg: el.options.curveDeg,
            puff: el.options.puff,
            motifKey: el.options.motifKey ?? undefined,
            motifSizeMm: el.options.motifSizeMm,
          })),
        })),
    [chosenKeys, designs, evaluations, customerItems],
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
        // Which box, when the position has more than one to confuse it with.
        designs[firstBroken].elements.length > 1 && evaluations[firstBroken].errorElement !== null
          ? evaluations[firstBroken].errorElement! + 1
          : null,
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

  /** The steps this session walks: a send-in skips Positions. */
  const steps = useMemo(() => STEPS.filter((s) => !(locked && s === "positions")), [locked]);
  const stepIndex = steps.indexOf(step);
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

  /** Every box of the open position, measured, as the preview draws it. */
  const previewElements: PreviewElement[] = useMemo(() => {
    if (!previewDesign || !activeEval) return [];
    return previewDesign.elements.map((el, i) => {
      const ev = activeEval.elements[i];
      const motif = el.options.contentType === "motif" && el.options.motifKey ? config.motifs.find((m) => m.key === el.options.motifKey) : null;
      return {
        id: el.id,
        font: config.fonts.find((f) => f.key === el.fontKey) ?? config.fonts[0],
        contentType: el.options.contentType,
        text: ev?.text ?? "",
        lines: ev?.lines ?? [],
        heightMm: el.heightMm,
        weightStep: el.weightStep,
        thread: config.threads.find((t) => t.id === el.threadId) ?? config.threads[0],
        curveDeg: el.options.curveDeg,
        trackingPct: el.options.trackingPct,
        kerning: el.options.kerning,
        motif: motif ? { path: motif.path, viewBox: motif.viewBox, sizeMm: el.options.motifSizeMm } : null,
        widthMm: ev?.widthMm ?? 0,
        stackMm: ev?.stackMm ?? el.heightMm,
        offset: el.offset,
        rotationDeg: el.rotationDeg,
        invalid: !!ev?.error && ev.error !== "empty",
      };
    });
  }, [previewDesign, activeEval, config.fonts, config.threads, config.motifs]);

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        {back?.onClick ? (
          <button type="button" className={styles.backLink} onClick={back.onClick}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{back.label}</span>
          </button>
        ) : (
          <Link href={back?.href ?? `/${locale}/shop/${product.slug}`} className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{back?.label ?? c.backToProduct}</span>
          </Link>
        )}
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
                elements={previewElements}
                activeElementId={activeElementId || null}
                onSelectElement={selectElement}
                onElementChange={(id, patch) => patchElement(patch, id)}
                placeholder={c.previewPlaceholder}
                quadPct={isUsableQuad(previewQuad) ? previewQuad : null}
                dragHint={c.dragHint}
                moveLabel={c.moveLabel}
                rotateLabel={c.rotateLabel}
                // Positions and Your design are for editing; Review is for
                // confirming, so the handles come off there.
                editable={step !== "review"}
              />
            )}

            {chosenKeys.length > 1 && (
              <div className={styles.angleRow} role="tablist" aria-label={c.angleLabel}>
                {/* Sides of a send-in are walked with arrows too: on a phone
                    three thumbnails and a photo do not all fit at once. */}
                {locked && (
                  <button
                    type="button"
                    className={styles.angleArrow}
                    aria-label={t.sendIn.prevSide}
                    disabled={chosenKeys.indexOf(activeKey) <= 0}
                    onClick={() => setActiveKey(chosenKeys[chosenKeys.indexOf(activeKey) - 1])}
                  >
                    <ArrowLeft size={14} aria-hidden="true" />
                  </button>
                )}
                {chosenKeys.map((k) => {
                  const p = config.placements.find((pl) => pl.key === k)!;
                  const done = !evaluations[k]?.error;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={k === activeKey}
                      className={`${styles.angleBtn} ${locked ? styles.angleBtnSide : ""} ${k === activeKey ? styles.angleBtnActive : ""} ${evaluations[k]?.error ? styles.angleBtnError : ""}`}
                      onClick={() => setActiveKey(k)}
                    >
                      {locked && p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className={styles.angleThumb} />
                      )}
                      <span className={styles.angleLabel}>
                        {p.label}
                        {locked && done && <Check size={11} aria-hidden="true" className={styles.angleDone} />}
                      </span>
                    </button>
                  );
                })}
                {locked && (
                  <button
                    type="button"
                    className={styles.angleArrow}
                    aria-label={t.sendIn.nextSide}
                    disabled={chosenKeys.indexOf(activeKey) >= chosenKeys.length - 1}
                    onClick={() => setActiveKey(chosenKeys[chosenKeys.indexOf(activeKey) + 1])}
                  >
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {activeEval && activePlacement && activeElementEval && (
              <>
                <div className={styles.fitRow}>
                  <div className={styles.fitMeter} role="img" aria-label={c.fitLabel}>
                    <div
                      className={`${styles.fitFill} ${activeElementEval.error === "tooWide" ? styles.fitFillOver : activeElementEval.widthFill > 0.99 ? styles.fitFillWide : ""}`}
                      style={{ width: `${Math.min(100, activeElementEval.widthFill * 100)}%` }}
                    />
                  </div>
                  <span className={styles.fitText}>
                    {Math.round(activeElementEval.widthMm)} / {Math.round(activePlacement.fieldWidthMm)} mm
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

                {isUsableQuad(previewQuad) && previewDesign && activeElement && (
                  <div className={styles.orientationRow}>
                    {/* Quarter turns of the open box. Labelled by angle rather
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
                          aria-checked={displayAngle(activeElement.rotationDeg) === deg}
                          className={`${styles.orientBtn} ${displayAngle(activeElement.rotationDeg) === deg ? styles.orientBtnActive : ""}`}
                          onClick={() => patchElement({ rotationDeg: deg })}
                          title={c.orientationTitle}
                        >
                          <RotateCw size={12} aria-hidden="true" style={{ transform: `rotate(${deg}deg)` }} />
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isUsableQuad(previewQuad) && previewDesign && activeElement && (
                  <div className={styles.positionRow}>
                    <span className={styles.positionText}>
                      {activeElement.offset.x === 0 && activeElement.offset.y === 0
                        ? c.positionCentred
                        : c.positionOffset.replace("{x}", activeElement.offset.x.toFixed(1)).replace("{y}", activeElement.offset.y.toFixed(1))}
                      {activeElement.rotationDeg !== 0 && ` · ${c.positionRotated.replace("{deg}", String(displayAngle(activeElement.rotationDeg)))}`}
                    </span>
                    <button
                      type="button"
                      className={styles.recentreBtn}
                      onClick={() => patchElement({ offset: { x: 0, y: 0 }, rotationDeg: 0 })}
                      disabled={activeElement.offset.x === 0 && activeElement.offset.y === 0 && activeElement.rotationDeg === 0}
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
            {precedingSteps.map((p, i) => (
              <li key={`pre-${i}`} className={styles.stepRailItem}>
                <button type="button" className={`${styles.stepDot} ${styles.stepDotDone}`} onClick={p.onClick}>
                  <span className={styles.stepNum}>
                    <Check size={13} aria-hidden="true" />
                  </span>
                  <span className={styles.stepName}>{p.label}</span>
                </button>
              </li>
            ))}
            {steps.map((s, i) => (
              <li key={s} className={styles.stepRailItem}>
                <button
                  type="button"
                  className={`${styles.stepDot} ${i === stepIndex ? styles.stepDotActive : ""} ${i < stepIndex ? styles.stepDotDone : ""}`}
                  onClick={() => (i <= stepIndex ? setStep(s) : undefined)}
                  disabled={i > stepIndex}
                  aria-current={i === stepIndex ? "step" : undefined}
                >
                  <span className={styles.stepNum}>{i < stepIndex ? <Check size={13} aria-hidden="true" /> : i + 1 + precedingSteps.length}</span>
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
                      <img src={p.imageUrl ?? undefined} alt="" className={styles.optionCardThumb} />
                      <span className={styles.optionCardBody}>
                        <span className={styles.optionCardTitle}>{p.label}</span>
                        {p.hint && <span className={styles.optionCardHint}>{p.hint}</span>}
                        <span className={styles.optionCardMeta}>{c.upToChars.replace("{n}", String(p.maxChars))}</span>
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

          {step === "design" && activePlacement && activeDesign && activeEval && activeElement && activeElementEval && (
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

              {/* The boxes on this position. Everything below acts on the
                  open one; the preview highlights it. */}
              <fieldset className={styles.panel}>
                <legend className={styles.panelTitle}>
                  <LayoutList size={15} aria-hidden="true" /> {c.boxesTitle}
                </legend>
                <p className={styles.panelHint}>{c.boxesHint}</p>
                <div className={styles.boxList} role="tablist" aria-label={c.boxesTitle}>
                  {activeDesign.elements.map((el, i) => {
                    const ev = activeEval.elements[i];
                    const thread = config.threads.find((t) => t.id === el.threadId) ?? config.threads[0];
                    const font = config.fonts.find((f) => f.key === el.fontKey) ?? config.fonts[0];
                    const selected = el.id === activeElementId;
                    const subject =
                      el.options.contentType === "motif"
                        ? (config.motifs.find((m) => m.key === el.options.motifKey)?.name ?? c.contentTypes.motif)
                        : ev?.text.replace(/\n/g, " / ") || c.boxEmpty;
                    return (
                      <div key={el.id} className={`${styles.boxRow} ${selected ? styles.boxRowActive : ""} ${ev?.error && ev.error !== "empty" ? styles.boxRowError : ""}`}>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          className={styles.boxRowMain}
                          onClick={() => selectElement(el.id)}
                          aria-label={c.boxLabel.replace("{n}", String(i + 1))}
                        >
                          <span className={styles.boxChip} style={{ background: thread?.hex }} aria-hidden="true" />
                          <span className={styles.boxText} style={{ fontFamily: font?.webFamily, fontWeight: weightForStep(el.weightStep).cssWeight }}>
                            {subject}
                          </span>
                          <span className={styles.boxMeta}>
                            {el.options.contentType === "motif" ? `${el.options.motifSizeMm} mm` : `${font?.name} · ${el.heightMm} mm`}
                          </span>
                        </button>
                        {activeDesign.elements.length > 1 && (
                          <button type="button" className={styles.boxRemove} onClick={() => removeElement(el.id)} aria-label={c.removeBox} title={c.removeBox}>
                            <X size={13} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className={styles.boxActions}>
                  <button type="button" className={styles.toolBtn} onClick={addElement} disabled={activeDesign.elements.length >= MAX_ELEMENTS}>
                    <Plus size={13} aria-hidden="true" /> {c.addBox}
                  </button>
                  <span className={styles.areaLimits}>{c.boxesMax.replace("{n}", String(MAX_ELEMENTS))}</span>
                </div>
              </fieldset>

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
                      aria-selected={activeElement.options.contentType === ct}
                      className={`${styles.segment} ${activeElement.options.contentType === ct ? styles.segmentActive : ""}`}
                      onClick={() => patchOptions({ contentType: ct })}
                    >
                      {c.contentTypes[ct]}
                    </button>
                  ))}
                </div>

                {activeElement.options.contentType === "motif" ? (
                  <>
                    <span className={styles.fieldLabel}>{c.motifTitle}</span>
                    <div className={styles.motifGrid}>
                      {config.motifs.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          className={`${styles.motifCard} ${activeElement.options.motifKey === m.key ? styles.motifCardActive : ""}`}
                          onClick={() => patchOptions({ motifKey: m.key })}
                          aria-pressed={activeElement.options.motifKey === m.key}
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
                      {activeElement.options.contentType === "monogram" ? c.monogramLabel : c.textLabel}
                    </label>
                    {/* A textarea, because a design can be several lines. It
                        grows with them rather than scrolling — there are at
                        most three, and a scrollbar would hide one. */}
                    <textarea
                      key={activeElement.id}
                      id="personalize-text"
                      className={`${styles.textInput} ${activeElementEval.error && activeElement.raw ? styles.textInputError : ""}`}
                      value={activeElement.raw}
                      onChange={(e) => patchElement({ raw: e.target.value })}
                      placeholder={activeElement.options.contentType === "monogram" ? c.monogramPlaceholder : c.textPlaceholder}
                      rows={Math.min(MAX_TEXT_LINES, Math.max(1, activeElementEval.lines.length))}
                      maxLength={
                        activeElement.options.contentType === "monogram"
                          ? MONOGRAM_MAX_CHARS + 2
                          : (activePlacement.maxChars + 4) * MAX_TEXT_LINES
                      }
                      autoComplete="off"
                      autoCapitalize={activeFont.uppercaseOnly ? "characters" : "words"}
                      spellCheck={false}
                      style={{ fontFamily: activeFont.webFamily, fontWeight: weightForStep(activeElement.weightStep).cssWeight }}
                      aria-describedby="personalize-text-help"
                    />
                    <div className={styles.fieldFooter} id="personalize-text-help">
                      <span className={styles.charCount}>
                        {activeElementEval.lines.reduce((n, l) => Math.max(n, l.length), 0)} /{" "}
                        {activeElement.options.contentType === "monogram" ? MONOGRAM_MAX_CHARS : activePlacement.maxChars}
                      </span>
                      <span className={styles.fieldNote}>
                        {activeElement.options.contentType === "monogram"
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
                      onClick={() => patchElement({ fontKey: f.key })}
                      aria-pressed={f.key === activeFont.key}
                    >
                      <span className={styles.fontSample} style={{ fontFamily: f.webFamily }}>
                        {activeElementEval.text.slice(0, 8) || c.fontSample}
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
                  {activeElement.options.contentType === "motif" ? c.motifSizeTitle : c.sizeTitle}
                </legend>
                <p className={styles.panelHint}>{customerItems ? c.sizeHintFlat : c.sizeHint}</p>
                {activeElement.options.contentType === "motif" ? (
                  <>
                    <div className={styles.sliderRow}>
                      <input
                        type="range"
                        className={styles.slider}
                        min={MOTIF_MIN_MM}
                        max={motifMax}
                        step={1}
                        value={activeElement.options.motifSizeMm}
                        onChange={(e) => patchOptions({ motifSizeMm: Number(e.target.value) })}
                        aria-label={c.motifSizeTitle}
                      />
                      <Stepper
                        label={c.motifSizeTitle}
                        compact
                        value={activeElement.options.motifSizeMm}
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
                        value={activeElement.heightMm}
                        onChange={(e) => patchElement({ heightMm: Number(e.target.value) })}
                        aria-label={c.sizeTitle}
                      />
                      <Stepper
                        label={c.sizeTitle}
                        compact
                        value={activeElement.heightMm}
                        min={bounds.min}
                        max={bounds.max}
                        onChange={(heightMm) => patchElement({ heightMm })}
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
                          className={`${styles.sizePreset} ${activeElement.heightMm === mm ? styles.sizePresetActive : ""}`}
                          onClick={() => patchElement({ heightMm: mm })}
                          aria-pressed={activeElement.heightMm === mm}
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
                      aria-checked={activeElement.weightStep === w.step}
                      className={`${styles.weightBtn} ${activeElement.weightStep === w.step ? styles.weightBtnActive : ""}`}
                      onClick={() => patchElement({ weightStep: w.step })}
                    >
                      {/* Each step previews itself in the customer's own text
                          and their chosen face — an abstract "Bold" label says
                          nothing about how a script will actually thicken. */}
                      <span
                        className={styles.weightSample}
                        style={{ fontFamily: activeFont.webFamily, fontWeight: w.cssWeight }}
                      >
                        {activeElementEval.text.slice(0, 5) || c.fontSample}
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
                {/* One spool per box. The hint names the chosen one, because a
                    swatch alone does not say "Fuchsia, Madeira 1921". */}
                <p className={styles.panelHint}>
                  <span className={styles.threadChosen}>
                    <span className={styles.boxChip} style={{ background: activeThread?.hex }} aria-hidden="true" />
                    {activeThread?.name}
                    <span className={styles.threadCode}>
                      {activeThread?.brand} {activeThread?.code}
                    </span>
                  </span>
                </p>
                <div className={styles.swatchGrid} role="radiogroup" aria-label={c.threadTitle}>
                  {config.threads.map((th) => {
                    const chosen = activeElement.threadId === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        className={`${styles.swatch} ${chosen ? styles.swatchActive : ""}`}
                        style={{ ["--swatch" as string]: th.hex }}
                        onClick={() => patchElement({ threadId: th.id })}
                        title={`${th.name} · ${th.brand} ${th.code}`}
                      >
                        <span className={styles.swatchChip} aria-hidden="true" />
                        {chosen && (
                          <span className={styles.swatchOrder}>
                            <Check size={10} aria-hidden="true" />
                          </span>
                        )}
                        <span className={styles.srOnly}>{th.name}</span>
                      </button>
                    );
                  })}
                </div>
                {activeDesign.elements.length === 1 && <p className={styles.fieldNote}>{c.threadOne}</p>}
              </fieldset>

              {activeElement.options.contentType !== "motif" && (
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
                        value={Math.round(activeElement.options.trackingPct * 100)}
                        onChange={(e) => patchOptions({ trackingPct: Number(e.target.value) / 100 })}
                        aria-label={c.trackingLabel}
                      />
                      <output className={styles.sliderValue}>
                        {activeElement.options.trackingPct > 0 ? "+" : ""}
                        {Math.round(activeElement.options.trackingPct * 100)}%
                      </output>
                    </div>

                    {/* Kerning is per gap, so it only appears once there are
                        gaps to nudge — and it is folded away, because most
                        customers will never need it. */}
                    {activeElementEval.lines.length === 1 && activeElementEval.lines[0].length > 1 && (
                      <details className={styles.kerning}>
                        <summary className={styles.kerningSummary}>{c.kerningLabel}</summary>
                        <p className={styles.panelHint}>{c.kerningHint}</p>
                        <div className={styles.kerningRow}>
                          {[...activeElementEval.lines[0]].slice(0, -1).map((ch, i) => (
                            <label key={i} className={styles.kerningGap}>
                              <span className={styles.kerningPair} style={{ fontFamily: activeFont.webFamily }}>
                                {ch}
                                {activeElementEval.lines[0][i + 1]}
                              </span>
                              <input
                                type="range"
                                className={styles.kerningSlider}
                                min={-KERNING_LIMIT * 100}
                                max={KERNING_LIMIT * 100}
                                step={2}
                                value={Math.round((activeElement.options.kerning?.[i] ?? 0) * 100)}
                                onChange={(e) => {
                                  const gaps = activeElementEval.lines[0].length - 1;
                                  const next = Array.from({ length: gaps }, (_, g) => activeElement.options.kerning?.[g] ?? 0);
                                  next[i] = Number(e.target.value) / 100;
                                  patchOptions({ kerning: next });
                                }}
                                aria-label={`${ch}${activeElementEval.lines[0][i + 1]}`}
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
                          value={activeElement.options.curveDeg}
                          onChange={(e) => patchOptions({ curveDeg: Number(e.target.value) })}
                          aria-label={c.curveTitle}
                        />
                        <output className={styles.sliderValue}>
                          {activeElement.options.curveDeg === 0 ? c.curveStraight : `${activeElement.options.curveDeg}°`}
                        </output>
                      </div>
                    </fieldset>
                  )}

                  <fieldset className={styles.panel}>
                    <legend className={styles.panelTitle}>
                      <Sparkles size={15} aria-hidden="true" /> {c.finishTitle}
                    </legend>

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
                        checked={activeElement.options.puff}
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

              {noteField && (
                <fieldset className={styles.panel}>
                  <legend className={styles.panelTitle}>
                    <StickyNote size={15} aria-hidden="true" /> {noteField.title}
                  </legend>
                  <p className={styles.panelHint}>{noteField.hint}</p>
                  <textarea
                    className={styles.noteInput}
                    rows={3}
                    maxLength={noteField.maxLength ?? 500}
                    value={noteField.value}
                    placeholder={noteField.placeholder}
                    onChange={(e) => noteField.onChange(e.target.value)}
                  />
                </fieldset>
              )}
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
                return (
                  <div key={k} className={styles.reviewCard}>
                    <div className={styles.reviewHead}>
                      <span className={styles.reviewPlacement}>{p.label}</span>
                      <span className={styles.reviewPrice}>€{euros(e.priceCents ?? 0)}</span>
                    </div>
                    {/* Every box, set large and in its own face and spool: the
                        whole point of this step is that a typo is visible,
                        and a typo in 13px body copy is not. */}
                    {d.elements.map((el, i) => {
                      const font = config.fonts.find((f) => f.key === el.fontKey) ?? config.fonts[0];
                      const thread = config.threads.find((th) => th.id === el.threadId);
                      const motif = el.options.contentType === "motif" ? config.motifs.find((m) => m.key === el.options.motifKey) : null;
                      return (
                        <div key={el.id} className={styles.reviewBox}>
                          <strong
                            className={styles.spellCheckText}
                            style={{ fontFamily: motif ? undefined : font.webFamily, fontWeight: weightForStep(el.weightStep).cssWeight, color: thread?.hex }}
                          >
                            {motif ? motif.name : e.elements[i]?.text}
                          </strong>
                          <p className={styles.reviewMeta}>
                            {motif ? `${el.options.motifSizeMm} mm` : `${font.name} · ${c.weightLabels[el.weightStep - 1]} · ${el.heightMm} mm`} · {thread?.name}
                            {el.rotationDeg !== 0 && ` · ${displayAngle(el.rotationDeg)}°`}
                          </p>
                        </div>
                      );
                    })}
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
                {/* A send-in is someone else's garment: the consent also covers
                    ownership, condition and the wear it already has. */}
                <span>{customerItems ? t.sendIn.consentItem : c.consent}</span>
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
          {/* On a customer's own item the whole figure is the sides' flat fees —
              "includes €X embroidery" would just repeat the total. */}
          {embroideryCents > 0 && (customerItems ? chosenKeys.length > 1 : true) && (
            <span className={styles.priceBreakdown}>
              {!customerItems && c.includesEmbroidery.replace("{price}", `€${euros(embroideryCents)}`)}
              {chosenKeys.length > 1 && `${customerItems ? "" : " · "}${c.acrossPositions.replace("{n}", String(chosenKeys.length))}`}
            </span>
          )}
        </div>

        <div className={styles.actions}>
          {stepIndex > 0 && (
            <button type="button" className={styles.secondaryBtn} onClick={() => setStep(steps[stepIndex - 1])}>
              {c.back}
            </button>
          )}
          {step !== "review" ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => setStep(steps[stepIndex + 1])}
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

function errorCopyForCode(code: string, placement: EditorPlacement, c: Copy, namePosition: boolean, boxNumber: number | null = null): string {
  // Only worth naming the position when there is more than one to confuse it
  // with — otherwise every message starts with a word that adds nothing. The
  // same goes for the box.
  const where = (msg: string) => {
    const parts = [namePosition ? placement.label : null, boxNumber ? c.boxLabel.replace("{n}", String(boxNumber)) : null].filter(Boolean);
    return parts.length ? `${parts.join(" · ")}: ${msg}` : msg;
  };
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
    case "tooManyBoxes":
      return where(c.errTooManyBoxes.replace("{n}", String(MAX_ELEMENTS)));
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
