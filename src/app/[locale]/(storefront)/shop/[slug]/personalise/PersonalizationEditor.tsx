"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, Loader2, AlertTriangle, Ruler, Palette, Type, MapPin,
  ShoppingBag, RotateCcw, RotateCw, Plus, Bold, ArrowRight, PencilLine,
} from "lucide-react";
import DesignPreview from "./DesignPreview";
import { useCart, type PersonalizationInput } from "@/components/shop/CartContext";
import { getTranslations, type Locale } from "@/lib/i18n";
import {
  evaluate, heightBounds, MONOGRAM_MAX_CHARS, DEFAULT_WEIGHT_STEP, WEIGHT_SCALE, weightForStep,
  type ContentType, type EditorConfig, type EditorEvaluation, type EditorPlacement,
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
  contentType: ContentType;
  raw: string;
  fontKey: string;
  threadIds: string[];
  heightMm: number;
  /** 1 (light) to 5 (extra bold) — how heavily the satin column is laid down. */
  weightStep: number;
  offset: Point;
  /** Angle in the garment's plane; the rotate handle drives it. */
  rotationDeg: number;
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
  const [activeKey, setActiveKey] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const [quote, setQuote] = useState<{ totalCents: number } | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const chosenKeys = useMemo(
    () => config.placements.filter((p) => designs[p.key]).map((p) => p.key),
    [config.placements, designs],
  );

  const defaultDesign = useCallback(
    (placement: EditorPlacement): DesignState => {
      const font = config.fonts[0];
      return {
        contentType: config.template.allowText ? "text" : "monogram",
        raw: "",
        fontKey: font?.key ?? "",
        threadIds: config.threads[0] ? [config.threads[0].id] : [],
        // Two thirds of the field's height is a flattering default that still
        // leaves room to move, rather than a fixed number that overflows a
        // small position and looks lost on a large one.
        heightMm: Math.max(font?.minHeightMm ?? 8, Math.round(placement.fieldHeightMm * 0.34)),
        weightStep: DEFAULT_WEIGHT_STEP,
        offset: { x: 0, y: 0 },
        rotationDeg: 0,
      };
    },
    [config.fonts, config.threads, config.template.allowText],
  );

  const togglePosition = useCallback(
    (placement: EditorPlacement) => {
      setDesigns((prev) => {
        const next = { ...prev };
        if (next[placement.key]) delete next[placement.key];
        else next[placement.key] = defaultDesign(placement);
        return next;
      });
      setActiveKey((prev) => (prev === placement.key ? "" : placement.key));
    },
    [defaultDesign],
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
      setDesigns((prev) => (prev[activeKey] ? { ...prev, [activeKey]: { ...prev[activeKey], ...patch } } : prev));
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
        contentType: d.contentType,
        font,
        placement,
        heightMm: d.heightMm,
        colorCount: new Set(d.threadIds).size,
        bands: config.priceBands,
        weightStep: d.weightStep,
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
    () => (activeDesign?.contentType === "monogram" ? config.fonts.filter((f) => f.supportsMonogram) : config.fonts),
    [config.fonts, activeDesign?.contentType],
  );

  const bounds = useMemo(
    () => (activeFont && activePlacement ? heightBounds(activeFont, activePlacement) : { min: 8, max: 40 }),
    [activeFont, activePlacement],
  );

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

  // ── Server quote for the whole set ───────────────────────────────────

  const payload: PersonalizationInput[] = useMemo(
    () =>
      chosenKeys
        .filter((k) => !evaluations[k]?.error)
        .map((k) => ({
          placementKey: k,
          contentType: designs[k].contentType,
          text: evaluations[k].text,
          fontKey: designs[k].fontKey,
          heightMm: designs[k].heightMm,
          weight: designs[k].weightStep,
          threadColorIds: designs[k].threadIds,
          offsetXMm: designs[k].offset.x,
          offsetYMm: designs[k].offset.y,
          rotationDeg: designs[k].rotationDeg,
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
          setQuoteError(errorCopy(body?.code, c) ?? c.errors.generic);
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

  // Read current designs inside the quote effect without re-subscribing on
  // every keystroke — quoteKey already re-runs it.
  const designsRef = useRef(designs);
  designsRef.current = designs;

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
    setAddError(errorCopy(result.code, c) ?? c.errors.addFailed);
  }, [addItem, variant.id, payload, openDrawer, c]);

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
                font={activeFont}
                text={activeEval?.text || c.previewPlaceholder}
                heightMm={previewDesign?.heightMm ?? 16}
                weightStep={previewDesign?.weightStep ?? DEFAULT_WEIGHT_STEP}
                thread={activeThreads[0] ?? config.threads[0]}
                invalid={!!activeEval?.error}
                quadPct={isUsableQuad(previewQuad) ? previewQuad : null}
                offset={previewDesign?.offset ?? { x: 0, y: 0 }}
                onOffsetChange={(offset) => patchActive({ offset })}
                rotationDeg={previewDesign?.rotationDeg ?? 0}
                onRotationChange={(rotationDeg) => patchActive({ rotationDeg })}
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
                    {Math.round(activeEval.widthMm)} / {activePlacement.fieldWidthMm} mm
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
                          {p.fieldWidthMm} × {p.fieldHeightMm} mm · {c.upToChars.replace("{n}", String(p.maxChars))}
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

          {step === "design" && activePlacement && activeDesign && activeEval && (
            <>
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

                {config.template.allowText && config.template.allowMonogram && (
                  <div className={styles.segmented} role="tablist" aria-label={c.contentTitle}>
                    {(["text", "monogram"] as ContentType[]).map((ct) => (
                      <button
                        key={ct}
                        type="button"
                        role="tab"
                        aria-selected={activeDesign.contentType === ct}
                        className={`${styles.segment} ${activeDesign.contentType === ct ? styles.segmentActive : ""}`}
                        onClick={() => patchActive({ contentType: ct })}
                      >
                        {c.contentTypes[ct]}
                      </button>
                    ))}
                  </div>
                )}

                <label className={styles.fieldLabel} htmlFor="personalize-text">
                  {activeDesign.contentType === "monogram" ? c.monogramLabel : c.textLabel}
                </label>
                <input
                  id="personalize-text"
                  className={`${styles.textInput} ${activeEval.error && activeDesign.raw ? styles.textInputError : ""}`}
                  value={activeDesign.raw}
                  onChange={(e) => patchActive({ raw: e.target.value })}
                  placeholder={activeDesign.contentType === "monogram" ? c.monogramPlaceholder : c.textPlaceholder}
                  maxLength={activeDesign.contentType === "monogram" ? MONOGRAM_MAX_CHARS + 2 : activePlacement.maxChars + 4}
                  autoComplete="off"
                  autoCapitalize={activeFont.uppercaseOnly ? "characters" : "words"}
                  spellCheck={false}
                  style={{ fontFamily: activeFont.webFamily, fontWeight: weightForStep(activeDesign.weightStep).cssWeight }}
                  aria-describedby="personalize-text-help"
                />
                <div className={styles.fieldFooter} id="personalize-text-help">
                  <span className={styles.charCount}>
                    {activeEval.text.length} /{" "}
                    {activeDesign.contentType === "monogram" ? MONOGRAM_MAX_CHARS : activePlacement.maxChars}
                  </span>
                  <span className={styles.fieldNote}>
                    {activeDesign.contentType === "monogram" ? c.monogramNote : c.textNote}
                  </span>
                </div>
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

              <fieldset className={styles.panel}>
                <legend className={styles.panelTitle}>
                  <Ruler size={15} aria-hidden="true" /> {c.sizeTitle}
                </legend>
                <p className={styles.panelHint}>{c.sizeHint}</p>
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
                  <output className={styles.sliderValue}>{activeDesign.heightMm} mm</output>
                </div>
                <div className={styles.sliderScale} aria-hidden="true">
                  <span>{bounds.min} mm</span>
                  <span>{bounds.max} mm</span>
                </div>
              </fieldset>
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
                      {threads.map((th) => th!.name).join(", ")}
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
    case "tooManyColors":
      return where(c.errors.tooManyColors.replace("{n}", String(placement.maxColors)));
    case "tooManyStitches":
      return where(c.errors.tooManyStitches);
    default:
      return where(c.errors.generic);
  }
}

function errorCopy(code: string | undefined, c: Copy): string | null {
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
    case "PERSONALIZATION_TOO_MANY_STITCHES":
      return c.errors.tooManyStitches;
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
