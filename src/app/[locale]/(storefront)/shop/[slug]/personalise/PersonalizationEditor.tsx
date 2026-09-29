"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, Loader2, AlertTriangle, Ruler, Palette, Type, MapPin,
  ShoppingBag, RotateCcw, RotateCw, Plus, Bold, ArrowRight, PencilLine,
  MoveHorizontal, Spline, Sparkles, Undo2, Redo2, Copy, Minus, LayoutList, X, StickyNote, ImagePlus, Trash2, RefreshCw, Search, ChevronDown, Check as CheckIcon, MoveVertical,
} from "lucide-react";
import DesignPreview, { type PreviewElement } from "./DesignPreview";
import { useCart, type CustomerItemInput, type PersonalizationInput } from "@/components/shop/CartContext";
import { getTranslations, type Locale } from "@/lib/i18n";
import {
  evaluateDesign, TEXT_MIN_HEIGHT_MM, DEFAULT_WEIGHT_STEP, WEIGHT_SCALE, weightForStep,
  DEFAULT_OPTIONS, MAX_TEXT_LINES, TRACKING_MIN, TRACKING_MAX, KERNING_LIMIT, CURVE_LIMIT_DEG,
  MOTIF_MIN_MM, MOTIF_MAX_MM, startingMotifWidthMm, DEFAULT_FIELD_LIMITS, MAX_ELEMENTS, ARTWORK_MIN_MM, limitsFor, pictureSizeMm,
  LINE_LEADING, lineWidthMm, normalizeLines, DEFAULT_TEXT_HEIGHT_MM,
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
const SIZE_PRESETS = [10, 15, 20, 25, 30, 40, 60, 80, 100, 150] as const;

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

/** For a preview that cannot be picked out — there is nothing to select. */
function noop(): void {}

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
      // The same starting height on every position of a catalogue product, so
      // the placeholder is the same size whichever panel the customer is
      // looking at. It used to be a third of the position's own panel height,
      // which is no longer a number anybody maintains — one position opened at
      // 17mm and its neighbour at 27mm purely because of stale rows.
      //
      // A send-in keeps the derived height: there the panel really is the
      // customer's own item, measured from the photo they sent, and a jacket
      // back is not a cap front.
      const startMm = placement.usesCustomerPhoto ? Math.round(placement.fieldHeightMm * 0.34) : DEFAULT_TEXT_HEIGHT_MM;
      const heightMm = startMm;
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
          // The design in this box, so its own surcharge is in the live figure.
          motif: config.motifs.find((m) => m.key === el.options.motifKey),
          offset: el.offset,
          rotationDeg: el.rotationDeg,
        })),
        placement,
        limits: limitsFor(placement, config.fieldLimits ?? DEFAULT_FIELD_LIMITS),
      });
    }
    return out;
  }, [config.placements, config.fonts, config.threads, config.motifs, config.fieldLimits, designs]);

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

  /** A shape or a logo may grow to the photograph on the customer's own item; to the usual cap on a catalogue position. */
  const activeLimits = useMemo(
    () => (activePlacement ? limitsFor(activePlacement, config.fieldLimits ?? DEFAULT_FIELD_LIMITS) : (config.fieldLimits ?? DEFAULT_FIELD_LIMITS)),
    [activePlacement, config.fieldLimits],
  );
  const motifMax = activePlacement?.usesCustomerPhoto ? Math.min(activeLimits.maxWidthMm, activeLimits.maxHeightMm) : MOTIF_MAX_MM;
  const artworkMax = activeLimits.maxWidthMm;

  /**
   * How big the lettering may be.
   *
   * A face used to carry its own 8–40mm range and anything outside it was
   * refused. That was an arbitrary answer to a question the geometry already
   * answers: the customer picks a size, and what decides whether it can be sewn
   * is whether the hoop fitted round the design fits the machine — measured, and
   * shown by the fit meter. So the control's range is the machine's own frame,
   * and the only floor is the far-off rail the DTO keeps.
   */
  const bounds = useMemo(
    () => ({ min: TEXT_MIN_HEIGHT_MM, max: Math.round(activeLimits.maxHeightMm) }),
    [activeLimits.maxHeightMm],
  );

  /**
   * What this shop offers: words, initials, and shapes if any are published.
   * On the customer's own item the shapes give way to their own logo — that
   * is the one place the shop digitises a file on demand.
   */
  const kinds = useMemo(() => {
    const out: ContentKind[] = [];
    if (config.template.allowText) out.push("text");
    if (config.template.allowMonogram) out.push("monogram");
    if (config.motifs.length) out.push("motif");
    if (customerItems) out.push("artwork");
    return out;
  }, [config.template.allowText, config.template.allowMonogram, config.motifs.length, customerItems]);

  // ── Web fonts ────────────────────────────────────────────────────────
  // Each face the shop offers is fetched once, here, on the page that needs
  // it — so the preview shows the customer the face they will get on the
  // phone they are holding, rather than whatever that phone falls back to.
  useEffect(() => {
    const hrefs = [...new Set(config.fonts.map((f) => f.webFontCss).filter((h): h is string => !!h))];
    for (const href of hrefs) {
      if (document.querySelector(`link[data-embroidery-font="${CSS.escape(href)}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.embroideryFont = href;
      document.head.appendChild(link);
    }
  }, [config.fonts]);

  /**
   * A full-colour design carries its own spools — no colour to pick, none to
   * send. Keyed on the design's own flag, not on whether it has shapes: a
   * one-colour design has shapes too and they are all sewn in the chosen
   * thread. (`?? paths?.length` for a server that has not been redeployed yet,
   * where the two questions were still one.)
   */
  const ownColours = useCallback(
    (opts: DesignOptions) => {
      if (opts.contentType !== "motif") return false;
      const m = config.motifs.find((x) => x.key === opts.motifKey);
      return !!m && (m.ownColours ?? !!m.paths?.length);
    },
    [config.motifs],
  );

  /**
   * A pull on a lettering box's border.
   *
   * Lettering has no width or height of its own to set — both come out of the
   * letters — so a handle cannot write them the way it writes a picture's. It
   * writes the control that actually moves that side instead:
   *
   * - the corner scales the LETTER HEIGHT, and the width follows, because a
   *   taller letter is a wider letter;
   * - the side edge opens or closes the TRACKING, which is the one thing that
   *   changes a line's width without changing the letters.
   *
   * Both are solved absolutely from the size the gesture reports rather than
   * applied as a step, because the gesture measures from where the drag began
   * and a per-move increment would compound as the box redraws under it.
   */
  const resizeLettering = useCallback(
    (target: ElementState, size: { widthMm: number; heightMm: number; axis: "x" | "y" | "xy" }) => {
      const font = config.fonts.find((f) => f.key === target.fontKey) ?? config.fonts[0];
      if (!font) return;
      const lines = normalizeLines(target.raw, target.options.contentType, font.uppercaseOnly);

      if (size.axis === "x") {
        // Width = the letters at this height + one tracking step per gap. One
        // unknown, so it inverts directly. A single letter has no gaps and
        // nothing to open, which is why the pull does nothing there.
        const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
        const gaps = longest.length - 1;
        if (gaps < 1) return;
        const h = target.heightMm;
        const bare = lineWidthMm({ line: longest, heightMm: h, font, contentType: target.options.contentType, weightStep: target.weightStep, trackingPct: 0, kerning: null });
        const kernSum = (target.options.kerning ?? []).reduce((sum, k) => sum + k, 0);
        const tracking = (size.widthMm - bare - kernSum * h) / (gaps * h);
        patchElement(
          { options: { ...target.options, trackingPct: Math.round(Math.min(TRACKING_MAX, Math.max(TRACKING_MIN, tracking)) * 100) / 100 } },
          target.id,
        );
        return;
      }

      // The stack is the lines at this height, spaced by the leading. An arched
      // line also rises above that, which this ignores: the sagitta depends on
      // the width, which depends on the height being solved for. The customer is
      // dragging until it looks right, and the height field stays exact.
      const lineCount = Math.max(1, lines.length);
      const leading = lineCount > 1 ? (target.options.leading ?? LINE_LEADING) : 1;
      const letterHeight = size.heightMm / (lineCount * leading);
      const clamped = Math.round(Math.min(bounds.max, Math.max(bounds.min, letterHeight)) * 10) / 10;
      if (clamped !== target.heightMm) patchElement({ heightMm: clamped }, target.id);
    },
    [config.fonts, bounds, patchElement],
  );

  // ── The design library ───────────────────────────────────────────────
  const [motifCategory, setMotifCategory] = useState<string>("all");
  /* The grid scrolls, so a category switch has to start at its first design
     rather than wherever the previous category was left. */
  const motifGridRef = useRef<HTMLDivElement>(null);
  /**
   * The tabs, in the shop's own order — admin data, arriving already named in
   * this language. Only tabs that actually hold a design are shown: an empty
   * one is a dead end, and the shop can have one mid-set-up without the
   * customer seeing it.
   */
  const motifCategories = useMemo(() => {
    const stocked = new Set(config.motifs.map((m) => m.category).filter(Boolean) as string[]);
    return (config.motifCategories ?? []).filter((cat) => stocked.has(cat.key));
  }, [config.motifCategories, config.motifs]);
  const motifCountFor = useCallback(
    (key: string) => config.motifs.filter((m) => m.category === key).length,
    [config.motifs],
  );
  const visibleMotifs = useMemo(
    () => (motifCategory === "all" ? config.motifs : config.motifs.filter((m) => m.category === motifCategory)),
    [config.motifs, motifCategory],
  );

  // ── The customer's own logo ──────────────────────────────────────────
  const [artworkBusy, setArtworkBusy] = useState(false);
  const [artworkError, setArtworkError] = useState<string | null>(null);
  const [artworkDrag, setArtworkDrag] = useState(false);
  /** Uploads the file, then puts its rendering on the open box at a sensible width. */
  const uploadArtwork = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setArtworkError(null);
      setArtworkBusy(true);
      try {
        const body = new FormData();
        body.append("artwork", file);
        const res = await fetch("/next-api/public/shop/send-in/artwork", { method: "POST", body });
        const data = (await res.json().catch(() => null)) as { key?: string; url?: string; name?: string; widthPx?: number; heightPx?: number; coverage?: number; message?: string } | null;
        if (!res.ok || !data?.key || !data.url) throw new Error(data?.message || "upload");
        const aspect = data.widthPx && data.heightPx ? data.heightPx / data.widthPx : 1;
        patchOptions({
          contentType: "artwork",
          artworkKey: data.key,
          artworkUrl: data.url,
          artworkName: data.name ?? file.name,
          artworkAspect: aspect,
          artworkHeightMm: null,
          artworkCoverage: data.coverage ?? 0.5,
        });
      } catch (err) {
        setArtworkError(err instanceof Error && err.message !== "upload" ? err.message : c.artworkError);
      } finally {
        setArtworkBusy(false);
      }
    },
    [patchOptions, c.artworkError],
  );

  // ── Keeping each position's choices internally consistent ────────────

  useEffect(() => {
    if (!activeDesign || !activeElement) return;
    const patch: Partial<ElementState> = {};
    if (!availableFonts.some((f) => f.key === activeElement.fontKey)) patch.fontKey = availableFonts[0]?.key;
    if (!config.threads.some((t) => t.id === activeElement.threadId)) patch.threadId = config.threads[0]?.id ?? "";
    if (Object.keys(patch).length) patchElement(patch);
    // No height clamp here any more: a face has no range of its own to pull a
    // size back into, and re-writing the customer's number behind their back is
    // exactly what made switching font feel like it lost their work.
  }, [activeDesign, activeElement, availableFonts, config.threads, patchElement]);

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
            // A logo carries its own colours — no spool to name.
            threadColorId: el.options.contentType === "artwork" || ownColours(el.options) ? undefined : el.threadId,
            weight: el.weightStep,
            offsetXMm: el.offset.x,
            offsetYMm: el.offset.y,
            rotationDeg: el.rotationDeg,
            trackingPct: el.options.trackingPct,
            kerning: el.options.kerning ?? undefined,
            curveDeg: el.options.curveDeg,
            puff: el.options.puff,
            borderMm: el.options.borderMm || undefined,
            leading: el.options.leading,
            motifKey: el.options.motifKey ?? undefined,
            motifSizeMm: el.options.motifSizeMm,
            motifHeightMm: el.options.motifHeightMm ?? undefined,
            artworkKey: el.options.artworkKey ?? undefined,
            artworkSizeMm: el.options.artworkSizeMm,
            artworkHeightMm: el.options.artworkHeightMm ?? undefined,
          })),
        })),
    [chosenKeys, designs, evaluations, customerItems, ownColours],
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
          setQuoteError(errorCopy(body?.code, c) ?? c.errors.generic);
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

  /**
   * What the embroidery costs so far.
   *
   * An evaluation prices a position only once its design is valid, and on the
   * Positions step nothing has been written yet — so every position evaluated
   * to `null`, which this read as zero and the bar sat at the bare product
   * price through the whole step. Ticking a card marked "+€10.00" moved the
   * total by nothing.
   *
   * A position's own price is settled the moment it is chosen: it pays for the
   * hooping and the run, and no design decision moves it. So a position with
   * nothing in it yet still contributes that much, and the same fallback keeps
   * the total steady while a design is mid-edit and briefly unpriceable rather
   * than dropping it to zero under an error message.
   */
  const localTotal = chosenKeys.reduce((sum, k) => {
    const priced = evaluations[k]?.priceCents;
    return sum + (priced ?? config.placements.find((p) => p.key === k)?.priceCents ?? 0);
  }, 0);
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
    setAddError(errorCopy(result.code, c) ?? c.errors.addFailed);
  }, [addItem, variant.id, payload, openDrawer, c]);

  const previewDesign = activeDesign;

  /**
   * The positions on screen: every one the customer has chosen, so a cap being
   * embroidered front and side shows both photographs together rather than one
   * at a time behind a switch. With nothing chosen yet it shows the first
   * position as a taster, so the page is never a blank rectangle.
   */
  const previewKeys = useMemo(
    () => (chosenKeys.length ? chosenKeys : config.placements[0] ? [config.placements[0].key] : []),
    [chosenKeys, config.placements],
  );

  /** Every box of one position, measured, as the preview draws it. */
  const elementsFor = useCallback((key: string): PreviewElement[] => {
    const design = designs[key];
    const evaluation = evaluations[key];
    if (!design || !evaluation) return [];
    return design.elements.map((el, i) => {
      const ev = evaluation.elements[i];
      const motif = el.options.contentType === "motif" && el.options.motifKey ? config.motifs.find((m) => m.key === el.options.motifKey) : null;
      return {
        id: el.id,
        font: config.fonts.find((f) => f.key === el.fontKey) ?? config.fonts[0],
        contentType: el.options.contentType,
        text: ev?.text ?? "",
        raw: el.raw,
        lines: ev?.lines ?? [],
        heightMm: el.heightMm,
        weightStep: el.weightStep,
        borderMm: customerItems && el.options.contentType !== "motif" && el.options.contentType !== "artwork" ? el.options.borderMm : 0,
        leading: el.options.leading,
        thread: config.threads.find((t) => t.id === el.threadId) ?? config.threads[0],
        curveDeg: el.options.curveDeg,
        trackingPct: el.options.trackingPct,
        kerning: el.options.kerning,
        motif: motif
          ? {
              path: motif.path,
              viewBox: motif.viewBox,
              sizeMm: el.options.motifSizeMm,
              heightMm: pictureSizeMm(el.options).heightMm,
              paths: motif.paths ?? null,
              ownColours: motif.ownColours ?? !!motif.paths?.length,
            }
          : null,
        artwork:
          el.options.contentType === "artwork" && el.options.artworkUrl
            ? { url: el.options.artworkUrl, widthMm: el.options.artworkSizeMm, heightMm: pictureSizeMm(el.options).heightMm }
            : null,
        widthMm: ev?.widthMm ?? 0,
        stackMm: ev?.stackMm ?? el.heightMm,
        offset: el.offset,
        rotationDeg: el.rotationDeg,
        invalid: !!ev?.error && ev.error !== "empty",
      };
    });
  }, [designs, evaluations, config.fonts, config.threads, config.motifs, customerItems]);

  /**
   * One position's photograph with its design drawn on it, as the preview card
   * the rail and the featured slot both use.
   *
   * A function rather than a component so it closes over the editor's state
   * directly: it is called from two places in one render, never mounted twice.
   */
  const renderPreview = (key: string) => {
    const placement = config.placements.find((p) => p.key === key);
    if (!placement) return null;
    const open = key === activeKey;
    /** Only the open position on the design step is a canvas to work in. */
    const editing = open && step === "design";
    /**
     * Whether one of these can be picked out.
     *
     * Only where that means something. On the Positions step no design is open
     * and the controls below are hidden, so "select this image" would change
     * nothing a customer can see — it is just a button that moves a highlight.
     * The panels are chosen on the cards below; up here the photographs are the
     * answer to "what is a front panel", nothing more.
     */
    const selectable = step !== "positions" && previewKeys.length > 1;
    return (
      <div
        key={key}
        className={`${styles.previewCard} ${editing ? styles.previewCardFeatured : ""} ${selectable && open ? styles.previewCardOpen : ""}`}
      >
        <DesignPreview
          imageUrl={placement.imageUrl}
          productTitle={product.title}
          placement={placement}
          elements={elementsFor(key)}
          activeElementId={open ? activeElementId || null : null}
          // Pressing a locked photo opens that position rather than
          // reaching into a design the controls are not pointed at —
          // and does nothing at all where there is nothing to open.
          onSelectElement={editing ? selectElement : selectable ? () => setActiveKey(key) : noop}
          onElementChange={(id, patch) => {
            if (!editing) return;
            if (patch.size) {
              const target = activeDesign?.elements.find((x) => x.id === id);
              if (!target) return;
              const o = target.options;
              // A picture has a width and a height of its own, so a
              // pull on a handle sets them directly.
              if (o.contentType === "artwork" || o.contentType === "motif") {
                const next: Partial<DesignOptions> =
                  o.contentType === "artwork"
                    ? { artworkSizeMm: Math.round(patch.size.widthMm), artworkHeightMm: Math.round(patch.size.heightMm) }
                    : { motifSizeMm: Math.round(patch.size.widthMm), motifHeightMm: Math.round(patch.size.heightMm) };
                patchElement({ options: { ...o, ...next } }, id);
                return;
              }
              resizeLettering(target, patch.size);
              return;
            }
            patchElement(patch, id);
          }}
          // A send-in's area is the four corners the CUSTOMER framed
          // on the photo of their own item — the one tracing that
          // survives, because nobody else can know where that panel
          // is. Null on a catalogue position, whose area is stated
          // on the row.
          quadPct={isUsableQuad(placement.corners as Quad | undefined) ? (placement.corners as Quad) : null}
          // Typing on a photograph writes into the box that is open there.
          // The two can only ever be the same box: a position is editable only
          // while it is the open one.
          onTextChange={(id, raw) => patchElement({ raw }, id)}
          textLabel={activeElement?.options.contentType === "monogram" ? c.monogramLabel : c.textLabel}
          resizeLabel={c.resizeLabel}
          placeholder={c.previewPlaceholder}
          logoPlaceholder={c.contentTypes.artwork}
          dragHint={c.dragHint}
          moveLabel={c.moveLabel}
          rotateLabel={c.rotateLabel}
          // Only Your design is for editing, and only the position
          // that is open. On Positions the preview answers "where
          // does it go" — it shows the placeholder sitting on the
          // panel and nothing else, because the customer has not
          // been offered a field to write in yet and a box they can
          // drag before typing invites them to arrange text that
          // does not exist. Review is for confirming.
          editable={editing}
        />

        {/* A caption belongs on a rail item, where there is room to read one.
            With one position there is nothing to name or choose between, and on
            the design step the featured card is already named by the tabs in the
            controls column. */}
        {previewKeys.length > 1 && step !== "design" &&
          (() => {
            const body = (
              <>
                <span className={styles.previewCaptionName}>{placement.label}</span>
                {/* On the Positions step every design is empty by
                    definition, so a "nothing written yet" mark on
                    every photograph says nothing and hides the one
                    thing that is worth reading there — what the
                    position costs. The mark starts once the customer
                    is actually writing: amber for a position still
                    to fill in, red for one that is wrong. The
                    sentence itself lives under the controls; a
                    caption is not where anybody reads an
                    explanation. */}
                {selectable && evaluations[key]?.error ? (
                  <span
                    className={`${styles.previewCaptionWarn} ${evaluations[key]?.error === "empty" ? styles.previewCaptionWarnEmpty : ""}`}
                    aria-hidden="true"
                  />
                ) : (
                  placement.priceCents > 0 && <span className={styles.previewCaptionPrice}>+€{euros(placement.priceCents)}</span>
                )}
              </>
            );
            // A label where there is nothing to open, a tab where
            // there is. Not a button that does nothing, which is
            // what a disabled one would be.
            return selectable ? (
              <button
                type="button"
                className={`${styles.previewCaption} ${open ? styles.previewCaptionOpen : ""}`}
                onClick={() => setActiveKey(key)}
                aria-current={open ? "true" : undefined}
              >
                {body}
              </button>
            ) : (
              <span className={styles.previewCaptionLabel}>{body}</span>
            );
          })()}
      </div>
    );
  };

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
            {/* Every chosen position, on screen together.
                A cap embroidered on the front and the side is two photographs,
                and the customer is deciding about both at once. How they are
                laid out follows what the step is for:

                - On Positions and Review nobody is working in one of them, so
                  they share the room equally, in a rail that scrolls sideways
                  rather than a grid that stacks. Three positions on a phone
                  would otherwise push the step panel off the screen.
                - On Your design one of them IS the working canvas, so it takes
                  the column and the rest shrink to thumbnails beside it. They
                  are there to be recognised and tapped, not worked in, and at
                  that size a live preview shows nothing a photograph does not.

                Only the open one ever takes a pointer: the controls below act on
                one design, and a handle on a photo nobody is working in would
                move something out of sight. */}
            {step === "design" ? (
              <>
                {activeKey && renderPreview(activeKey)}

                {/* Not a tablist: the open position is the featured card above,
                    not one of these, and a tablist whose selected tab is
                    somewhere else is a lie to a screen reader. The real one is
                    `designTabs` in the controls column; these are a pointer
                    shortcut to the same thing. */}
                {previewKeys.length > 1 && (
                  <div className={styles.thumbRail}>
                    {previewKeys
                      .filter((key) => key !== activeKey)
                      .map((key) => {
                        const placement = config.placements.find((p) => p.key === key);
                        if (!placement) return null;
                        const trouble = evaluations[key]?.error;
                        return (
                          <button
                            key={key}
                            type="button"
                            className={styles.thumb}
                            onClick={() => setActiveKey(key)}
                            title={placement.label}
                            aria-label={placement.label}
                          >
                            {/* The photograph, not a preview: at this size the
                                lettering is a few pixels tall, and a second
                                measured canvas per position would cost a
                                ResizeObserver and an SVG to show nothing. */}
                            {placement.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={placement.imageUrl} alt="" className={styles.thumbImg} />
                            )}
                            {trouble && (
                              <span
                                className={`${styles.thumbDot} ${trouble === "empty" ? styles.thumbDotEmpty : ""}`}
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                  </div>
                )}
              </>
            ) : (
              <div className={`${styles.previewRail} ${previewKeys.length > 1 ? styles.previewRailMulti : ""}`}>
                {previewKeys.map((key) => renderPreview(key))}
              </div>
            )}

            {/* Everything below the photographs is for working on one design:
                how wide the lettering came out, its quarter turn, and where it
                sits. On the Positions step none of that is the question being
                asked — the customer is picking panels — so the column is the
                photographs and nothing else until the design step.

                The row of text buttons that used to walk between positions has
                gone with it: each photo now carries its own caption, which says
                the same thing while being attached to the thing it names. */}
            {/* The width meter that used to sit here is gone. It filled against
                the position's `fieldWidthMm` and turned amber past it, meaning
                "wider than the panel we photographed" — but that number stopped
                being a measurement when the tracing was removed: it is the same
                constant for every position now, so the warning fired on designs
                the machine has no trouble with, and fired constantly once
                lettering could be any height. The limit that is real — the hoop
                against the machine's frame — is checked locally and says so
                immediately, in words, under these controls. */}
            {step !== "positions" && (
              <>
                {previewDesign && activeElement && (
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

                {previewDesign && activeElement && (
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
                    const isArtwork = el.options.contentType === "artwork";
                    const subject = isArtwork
                      ? (el.options.artworkName ?? c.contentTypes.artwork)
                      : el.options.contentType === "motif"
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
                          {isArtwork && el.options.artworkUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={el.options.artworkUrl} alt="" className={styles.boxThumb} />
                          ) : ownColours(el.options) ? (
                            (() => {
                              const m = config.motifs.find((x) => x.key === el.options.motifKey);
                              return m ? (
                                <svg viewBox={m.viewBox} className={styles.boxThumb} aria-hidden="true">
                                  {(m.paths ?? []).map((sp, i) => <path key={i} d={sp.d} fill={sp.fill} transform={sp.transform} />)}
                                </svg>
                              ) : null;
                            })()
                          ) : (
                            <span className={styles.boxChip} style={{ background: thread?.hex }} aria-hidden="true" />
                          )}
                          <span className={styles.boxText} style={isArtwork || el.options.contentType === "motif" ? undefined : { fontFamily: font?.webFamily, fontWeight: weightForStep(el.weightStep).cssWeight }}>
                            {subject}
                          </span>
                          <span className={styles.boxMeta}>
                            {isArtwork
                              ? `${el.options.artworkSizeMm} mm`
                              : el.options.contentType === "motif"
                                ? `${el.options.motifSizeMm} mm`
                                : `${font?.name} · ${el.heightMm} mm`}
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

                {activeElement.options.contentType === "artwork" ? (
                  <div className={styles.artwork}>
                    <p className={styles.panelHint}>{c.artworkHint}</p>
                    {activeElement.options.artworkUrl ? (
                      <div className={styles.artworkCard}>
                        <span className={styles.artworkThumb}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={activeElement.options.artworkUrl} alt="" />
                        </span>
                        <div className={styles.artworkBody}>
                          <strong className={styles.artworkName}>{activeElement.options.artworkName}</strong>
                          <span className={styles.artworkMeta}>
                            {activeElement.options.artworkSizeMm} × {Math.round(activeElement.options.artworkSizeMm * (activeElement.options.artworkAspect || 1))} mm
                          </span>
                          <div className={styles.artworkActions}>
                            <label className={styles.toolBtn}>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                className={styles.srOnly}
                                disabled={artworkBusy}
                                onChange={(e) => {
                                  void uploadArtwork(e.target.files?.[0]);
                                  e.target.value = "";
                                }}
                              />
                              {artworkBusy ? <Loader2 size={13} className={styles.spin} aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />} {c.artworkReplace}
                            </label>
                            <button
                              type="button"
                              className={styles.toolBtn}
                              onClick={() => patchOptions({ artworkKey: null, artworkUrl: null, artworkName: null, artworkAspect: 1, artworkCoverage: 0.5 })}
                            >
                              <Trash2 size={13} aria-hidden="true" /> {c.artworkRemove}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label
                        className={`${styles.artworkDrop} ${artworkDrag ? styles.artworkDropActive : ""} ${artworkBusy ? styles.artworkDropBusy : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setArtworkDrag(true);
                        }}
                        onDragLeave={() => setArtworkDrag(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setArtworkDrag(false);
                          void uploadArtwork(e.dataTransfer.files?.[0]);
                        }}
                      >
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className={styles.srOnly}
                          disabled={artworkBusy}
                          onChange={(e) => {
                            void uploadArtwork(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                        <span className={styles.artworkDropIcon}>
                          {artworkBusy ? <Loader2 size={22} className={styles.spin} aria-hidden="true" /> : <ImagePlus size={22} aria-hidden="true" />}
                        </span>
                        <span className={styles.artworkDropLabel}>{artworkBusy ? c.artworkUploading : c.artworkUpload}</span>
                        <span className={styles.artworkDropNote}>{c.artworkFormats}</span>
                      </label>
                    )}
                    {artworkError && (
                      <p className={styles.errorBox} role="alert">
                        {artworkError}
                      </p>
                    )}
                    <p className={styles.artworkDigitise}>
                      <Sparkles size={13} aria-hidden="true" /> {c.artworkDigitise}
                    </p>
                  </div>
                ) : activeElement.options.contentType === "motif" ? (
                  <>
                    <span className={styles.fieldLabel}>{c.motifTitle}</span>
                    {motifCategories.length > 0 && (
                      <div className={styles.motifCats} role="tablist" aria-label={c.motifTitle}>
                        {/* "All" is not a tab the shop owns — it is the absence
                            of a filter, so its label stays ours. */}
                        {[{ key: "all", name: c.motifCategoryAll }, ...motifCategories].map((cat) => (
                          <button
                            key={cat.key}
                            type="button"
                            role="tab"
                            aria-selected={motifCategory === cat.key}
                            className={`${styles.motifCat} ${motifCategory === cat.key ? styles.motifCatActive : ""}`}
                            onClick={() => {
                              setMotifCategory(cat.key);
                              motifGridRef.current?.scrollTo({ top: 0 });
                            }}
                          >
                            {cat.name}
                            <span className={styles.motifCatCount}>{cat.key === "all" ? config.motifs.length : motifCountFor(cat.key)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className={styles.motifGrid} ref={motifGridRef}>
                      {visibleMotifs.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          className={`${styles.motifCard} ${activeElement.options.motifKey === m.key ? styles.motifCardActive : ""}`}
                          onClick={() => {
                            const [, , vw, vh] = m.viewBox.split(/\s+/).map(Number);
                            const aspect = (vh || 100) / (vw || 100);
                            // A design does not always fit at the usual 30mm:
                            // a wide one is under the machine's 15mm minimum on
                            // its short side long before its width runs out. It
                            // opens at a width where both sides are stitchable,
                            // so picking a shape never lands on an error.
                            const widthMm = startingMotifWidthMm(aspect, activeLimits.maxHeightMm) ?? activeElement.options.motifSizeMm;
                            patchOptions({ motifKey: m.key, motifAspect: aspect, motifSizeMm: widthMm, motifHeightMm: null });
                          }}
                          aria-pressed={activeElement.options.motifKey === m.key}
                          title={m.name}
                        >
                          {/* The catalogue is admin-authored, so the path goes
                              on a `d` attribute — never injected as markup. */}
                          <svg viewBox={m.viewBox} className={styles.motifSvg} aria-hidden="true">
                            {/* Drawn the way it is sewn: its own fills when it
                                keeps them, otherwise every shape in one colour,
                                which is what a chosen spool does to it. */}
                            {m.paths?.length
                              ? m.paths.map((sp, i) => <path key={i} d={sp.d} fill={(m.ownColours ?? true) ? sp.fill : "currentColor"} transform={sp.transform} />)
                              : <path d={m.path} fill="currentColor" />}
                          </svg>
                          <span className={styles.motifName}>{m.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  /* There is no field here: the customer writes on the cap.
                     Tapping the lettering in the photograph opens the keyboard
                     and the letters follow the typing, so the thing being edited
                     and the thing being looked at are the same object. What is
                     left to say is the rule the box still holds them to. */
                  <p className={styles.panelHint}>
                    {c.writeOnPhoto}{" "}
                    {activeElement.options.contentType === "monogram"
                      ? c.monogramNote
                      : c.linesHint.replace("{n}", String(MAX_TEXT_LINES))}
                  </p>
                )}
              </fieldset>

              {activeElement.options.contentType !== "artwork" && activeElement.options.contentType !== "motif" && (
              <fieldset className={styles.panel}>
                <legend className={styles.panelTitle}>
                  <Type size={15} aria-hidden="true" /> {c.fontTitle}
                </legend>
                <FontPicker
                  fonts={availableFonts}
                  value={activeFont.key}
                  sample={activeElementEval.text.slice(0, 12) || c.fontSample}
                  searchPlaceholder={c.fontSearch}
                  emptyLabel={c.fontSearchEmpty}
                  countLabel={c.fontCount.replace("{n}", String(availableFonts.length))}
                  onChange={(fontKey) => patchElement({ fontKey })}
                />
              </fieldset>
              )}

              {/* Size sits right under the face: pick the letters, then how
                  big. A slider for feel, a typed field for "exactly 25". */}
              <fieldset className={styles.panel}>
                <legend className={styles.panelTitle}>
                  <Ruler size={15} aria-hidden="true" />{" "}
                  {activeElement.options.contentType === "artwork" ? c.artworkSizeTitle : activeElement.options.contentType === "motif" ? c.motifSizeTitle : c.sizeTitle}
                </legend>
                <p className={styles.panelHint}>
                  {activeElement.options.contentType === "artwork" ? c.artworkSizeHint : activeElement.options.contentType === "motif" ? c.motifSizeHint : customerItems ? c.sizeHintFlat : c.sizeHint}
                </p>
                {activeElement.options.contentType === "artwork" || activeElement.options.contentType === "motif" ? (
                  (() => {
                    const isArt = activeElement.options.contentType === "artwork";
                    const size = pictureSizeMm(activeElement.options);
                    const aspect = isArt ? activeElement.options.artworkAspect || 1 : activeElement.options.motifAspect || 1;
                    const minMm = isArt ? ARTWORK_MIN_MM : MOTIF_MIN_MM;
                    const maxW = isArt ? artworkMax : motifMax;
                    const maxH = activePlacement?.usesCustomerPhoto ? activeLimits.maxHeightMm : motifMax;
                    const stretched = isArt ? activeElement.options.artworkHeightMm !== null : activeElement.options.motifHeightMm !== null;
                    const setSize = (widthMm: number, heightMm: number | null) =>
                      patchOptions(isArt ? { artworkSizeMm: widthMm, artworkHeightMm: heightMm } : { motifSizeMm: widthMm, motifHeightMm: heightMm });
                    return (
                      <div className={styles.sizeGrid}>
                        <div>
                          <span className={styles.fieldLabel}>{c.widthLabel}</span>
                          <div className={styles.sliderRow}>
                            <input
                              type="range"
                              className={styles.slider}
                              min={minMm}
                              max={maxW}
                              step={1}
                              value={Math.round(size.widthMm)}
                              onChange={(e) => setSize(Number(e.target.value), stretched ? size.heightMm : null)}
                              aria-label={c.widthLabel}
                            />
                            <Stepper label={c.widthLabel} compact value={Math.round(size.widthMm)} min={minMm} max={maxW} onChange={(w) => setSize(w, stretched ? size.heightMm : null)} />
                          </div>
                        </div>
                        <div>
                          <span className={styles.fieldLabel}>{c.heightLabel}</span>
                          <div className={styles.sliderRow}>
                            <input
                              type="range"
                              className={styles.slider}
                              min={minMm}
                              max={maxH}
                              step={1}
                              value={Math.round(size.heightMm)}
                              onChange={(e) => setSize(size.widthMm, Number(e.target.value))}
                              aria-label={c.heightLabel}
                            />
                            <Stepper label={c.heightLabel} compact value={Math.round(size.heightMm)} min={minMm} max={maxH} onChange={(h) => setSize(size.widthMm, h)} />
                          </div>
                        </div>
                        <div className={styles.sizeFooter}>
                          <span className={styles.fieldNote}>{c.resizeHint}</span>
                          {stretched && (
                            <button type="button" className={styles.recentreBtn} onClick={() => setSize(size.widthMm, null)} title={`${Math.round(size.widthMm)} × ${Math.round(size.widthMm * aspect)} mm`}>
                              {c.keepProportions}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()
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

              {activeElement.options.contentType !== "artwork" && activeElement.options.contentType !== "motif" && (
              <fieldset className={styles.panel}>
                <legend className={styles.panelTitle}>
                  <Bold size={15} aria-hidden="true" /> {c.weightTitle}
                </legend>
                <p className={styles.panelHint}>{customerItems ? c.borderHint : c.weightHint}</p>
                {/* Five faces' worth of weight on a catalogue product — priced by
                    the band. On the customer's own item thickness is one thing:
                    the satin border, as many millimetres as they like. */}
                {!customerItems && (
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
                )}
                {customerItems && (
                  <div>
                    <div className={styles.sliderRow}>
                      <input
                        type="range"
                        className={styles.slider}
                        min={0}
                        max={Math.max(10, Math.round(activeElement.heightMm))}
                        step={0.5}
                        value={activeElement.options.borderMm}
                        onChange={(e) => patchOptions({ borderMm: Number(e.target.value) })}
                        aria-label={c.weightTitle}
                      />
                      <Stepper label={c.weightTitle} compact value={activeElement.options.borderMm} min={0} max={activeLimits.maxHeightMm} step={0.5} onChange={(borderMm) => patchOptions({ borderMm })} />
                    </div>
                    <div className={styles.sliderScale} aria-hidden="true">
                      <span>{c.borderNone}</span>
                      <span>{Math.max(10, Math.round(activeElement.heightMm))} mm</span>
                    </div>
                  </div>
                )}
              </fieldset>
              )}

              {activeElement.options.contentType !== "artwork" && !ownColours(activeElement.options) && (
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
              )}

              {activeElement.options.contentType !== "motif" && activeElement.options.contentType !== "artwork" && (
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

                  {/* Leading only once there is a second line to space from the first. */}
                  {activeElementEval.lines.length > 1 && (
                    <fieldset className={styles.panel}>
                      <legend className={styles.panelTitle}>
                        <MoveVertical size={15} aria-hidden="true" /> {c.leadingTitle}
                      </legend>
                      <p className={styles.panelHint}>{c.leadingHint}</p>
                      <div className={styles.sliderRow}>
                        <input
                          type="range"
                          className={styles.slider}
                          min={80}
                          max={300}
                          step={5}
                          value={Math.round(activeElement.options.leading * 100)}
                          onChange={(e) => patchOptions({ leading: Number(e.target.value) / 100 })}
                          aria-label={c.leadingTitle}
                        />
                        <output className={styles.sliderValue}>{Math.round(activeElement.options.leading * 100)}%</output>
                      </div>
                    </fieldset>
                  )}

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
                      if (el.options.contentType === "artwork") {
                        // Their own file, shown as it will be digitised — the
                        // spelling check here is "is that the right logo".
                        return (
                          <div key={el.id} className={`${styles.reviewBox} ${styles.reviewArtwork}`}>
                            {el.options.artworkUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={el.options.artworkUrl} alt="" className={styles.reviewArtworkImg} />
                            )}
                            <div>
                              <strong className={styles.reviewArtworkName}>{el.options.artworkName}</strong>
                              <p className={styles.reviewMeta}>
                                {c.contentTypes.artwork} · {el.options.artworkSizeMm} × {Math.round(el.options.artworkSizeMm * (el.options.artworkAspect || 1))} mm
                                {el.rotationDeg !== 0 && ` · ${displayAngle(el.rotationDeg)}°`}
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={el.id} className={styles.reviewBox}>
                          <strong
                            className={styles.spellCheckText}
                            style={{ fontFamily: motif ? undefined : font.webFamily, fontWeight: weightForStep(el.weightStep).cssWeight, color: thread?.hex }}
                          >
                            {motif ? motif.name : e.elements[i]?.text}
                          </strong>
                          <p className={styles.reviewMeta}>
                            {motif ? `${el.options.motifSizeMm} mm` : `${font.name} · ${c.weightLabels[el.weightStep - 1]} · ${el.heightMm} mm`}
                            {motif && (motif.ownColours ?? !!motif.paths?.length) ? ` · ${c.ownColours}` : ` · ${thread?.name ?? ""}`}
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
    case "motifSize":
      return where(c.errors.motifSize.replace("{min}", String(MOTIF_MIN_MM)).replace("{max}", String(MOTIF_MAX_MM)));
    default:
      return where(c.errors.generic);
  }
}

function errorCopy(code: string | undefined, c: Copy): string | null {
  switch (code) {
    case "PERSONALIZATION_TEXT_EMPTY":
      return c.errors.empty;
    case "PERSONALIZATION_TEXT_UNSTITCHABLE":
      return c.errors.unstitchable;
    case "PERSONALIZATION_TEXT_BLOCKED":
      return c.errors.blocked;
    case "PERSONALIZATION_MONOGRAM_LENGTH":
      return c.errors.monogramLength;
    case "PERSONALIZATION_TOO_WIDE":
      return c.errors.tooWide;
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
    case "PERSONALIZATION_MOTIF_SIZE":
      return c.errors.motifSize.replace("{min}", String(MOTIF_MIN_MM)).replace("{max}", String(MOTIF_MAX_MM));
    case "PERSONALIZATION_MOTIF_UNKNOWN":
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
/**
 * The face, as a searchable dropdown: the chosen face set large in the
 * customer's own words, and a list that opens under it with every face drawn
 * in itself. Eighteen faces as cards took the whole column; here they take
 * one row until asked for.
 */
function FontPicker({
  fonts,
  value,
  sample,
  searchPlaceholder,
  emptyLabel,
  countLabel,
  onChange,
}: {
  fonts: EditorConfig["fonts"];
  value: string;
  sample: string;
  searchPlaceholder: string;
  emptyLabel: string;
  countLabel: string;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const current = fonts.find((f) => f.key === value) ?? fonts[0];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? fonts.filter((f) => f.name.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)) : fonts;
  }, [fonts, query]);

  // Closes on a click anywhere else, or on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  // The highlighted row stays in view as the arrows move it.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  const choose = (key: string) => {
    onChange(key);
    setOpen(false);
    setQuery("");
  };
  const toggle = () => {
    setOpen((o) => !o);
    setQuery("");
    setCursor(Math.max(0, fonts.findIndex((f) => f.key === value)));
  };

  return (
    <div className={styles.fontPicker} ref={rootRef}>
      <button type="button" className={`${styles.fontPickerBtn} ${open ? styles.fontPickerBtnOpen : ""}`} onClick={toggle} aria-haspopup="listbox" aria-expanded={open}>
        <span className={styles.fontPickerSample} style={{ fontFamily: current?.webFamily }}>
          {sample}
        </span>
        <span className={styles.fontPickerMeta}>
          <span className={styles.fontPickerName}>{current?.name}</span>
          <span className={styles.fontPickerCount}>{countLabel}</span>
        </span>
        <ChevronDown size={16} className={styles.fontPickerChevron} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.fontPickerMenu}>
          <label className={styles.fontPickerSearch}>
            <Search size={14} aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder={searchPlaceholder}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((i) => Math.min(shown.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (shown[cursor]) choose(shown[cursor].key);
                }
              }}
              aria-label={searchPlaceholder}
              autoComplete="off"
            />
          </label>
          <ul className={styles.fontPickerList} role="listbox" ref={listRef}>
            {shown.length === 0 && <li className={styles.fontPickerEmpty}>{emptyLabel}</li>}
            {shown.map((f, i) => (
              <li
                key={f.key}
                role="option"
                aria-selected={f.key === value}
                data-index={i}
                className={`${styles.fontPickerRow} ${i === cursor ? styles.fontPickerRowCursor : ""} ${f.key === value ? styles.fontPickerRowActive : ""}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => choose(f.key)}
              >
                <span className={styles.fontPickerRowSample} style={{ fontFamily: f.webFamily }}>
                  {sample}
                </span>
                <span className={styles.fontPickerRowName}>{f.name}</span>
                {f.key === value && <CheckIcon size={15} className={styles.fontPickerRowCheck} aria-hidden="true" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  compact = false,
  step = 1,
  unit = "mm",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** No visible label — for sitting beside a slider that already has one. */
  compact?: boolean;
  /** How far the −/+ buttons move, and the input's step. */
  step?: number;
  unit?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(step < 1 ? Math.round(value / step) * step : Math.round(value));
  const commit = () => {
    const n = Number(draft);
    if (draft !== null && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };
  const nudge = (d: number) => onChange(Math.min(max, Math.max(min, step < 1 ? Math.round((value + d * step) / step) * step : Math.round(value + d * step))));

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
          step={step}
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
        <span className={styles.stepperUnit}>{unit}</span>
        <button type="button" className={styles.stepperBtn} onClick={() => nudge(1)} disabled={value >= max} aria-label={`${label} +1`}>
          <Plus size={13} aria-hidden="true" />
        </button>
      </span>
    </label>
  );
}
