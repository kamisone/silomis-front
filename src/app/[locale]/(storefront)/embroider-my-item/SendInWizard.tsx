"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Camera, ImagePlus, Loader2, Shirt, X } from "lucide-react";
import PersonalizationEditor from "../shop/[slug]/personalise/PersonalizationEditor";
import type { CustomerItemInput } from "@/components/shop/CartContext";
import type { EditorConfig } from "@/lib/shop/embroidery";
import { getTranslations, type Locale } from "@/lib/i18n";
import styles from "./SendIn.module.css";

export interface SendInItemType {
  key: string;
  label: string;
  hint: string | null;
  imageUrl: string | null;
  variantId: string;
  priceCents: number;
  allowPuff: boolean;
  maxChars: number;
}

export interface SendInConfig {
  productId: string;
  productSlug: string;
  productTitle: string;
  /** One position per side the customer may photograph, in order. */
  placementKeys: string[];
  maxSides: number;
  itemTypes: SendInItemType[];
  returnAddress: { name: string; line1: string; zip: string; city: string; country: string };
}

interface Props {
  locale: Locale;
  config: SendInConfig;
  editorConfig: EditorConfig;
}

type Step = "item" | "design";

/** One photographed side of the item: the uploaded key, its signed URL, and a local preview. */
interface Side {
  key: string;
  url: string;
  preview: string;
}

/**
 * Where the item type's typical panel is assumed to sit on the photo, as % of
 * the image box — the middle, where a front-on photo of a cap or a chest has
 * it. The customer then drags the boxes wherever they belong; the panel is
 * only what turns millimetres into pixels for the preview.
 */
const PANEL_ON_PHOTO = { l: 28, t: 34, r: 72, b: 60 };

function euros(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Two steps: what the item is and a photograph of it, then the ordinary
 * embroidery editor on that photograph. The scale of the preview comes from
 * the item type's typical panel size rather than from a measurement — the
 * design is priced and sheeted in real millimetres regardless, and the desk
 * checks it against the item when the parcel arrives.
 */
export default function SendInWizard({ locale, config, editorConfig }: Props) {
  const t = getTranslations(locale);
  const c = t.sendIn;

  const [step, setStep] = useState<Step>("item");
  const [typeKey, setTypeKey] = useState(config.itemTypes[0]?.key ?? "");
  const [sides, setSides] = useState<Side[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [note, setNote] = useState("");

  const type = useMemo(() => config.itemTypes.find((x) => x.key === typeKey) ?? config.itemTypes[0], [config.itemTypes, typeKey]);

  const onPickPhoto = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setUploadError("");
      setUploading(true);
      const preview = URL.createObjectURL(file);
      try {
        const body = new FormData();
        body.append("photos", file);
        const res = await fetch("/next-api/public/shop/send-in/photos", { method: "POST", body });
        if (!res.ok) throw new Error("upload");
        const data = (await res.json()) as { photos: { key: string; url: string }[] };
        const first = data.photos[0];
        if (!first) throw new Error("upload");
        setSides((prev) => {
          if (prev.length >= config.maxSides) return prev;
          return [...prev, { key: first.key, url: first.url, preview }];
        });
      } catch {
        URL.revokeObjectURL(preview);
        setUploadError(c.photoError);
      } finally {
        setUploading(false);
      }
    },
    [c.photoError, config.maxSides],
  );

  const removeSide = useCallback((key: string) => {
    setSides((prev) => {
      const gone = prev.find((sd) => sd.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((sd) => sd.key !== key);
    });
  }, []);

  /** One customer item per side, keyed by the position it will be designed on. */
  const customerItems: Record<string, CustomerItemInput> | null = useMemo(() => {
    if (!sides.length || !type) return null;
    const corners = [
      { x: PANEL_ON_PHOTO.l, y: PANEL_ON_PHOTO.t },
      { x: PANEL_ON_PHOTO.r, y: PANEL_ON_PHOTO.t },
      { x: PANEL_ON_PHOTO.r, y: PANEL_ON_PHOTO.b },
      { x: PANEL_ON_PHOTO.l, y: PANEL_ON_PHOTO.b },
    ];
    return Object.fromEntries(
      sides.map((sd, i) => [
        config.placementKeys[i],
        {
          itemType: type.key,
          photoKeys: [sd.key],
          corners,
          note: note.trim() || undefined,
        },
      ]),
    );
  }, [sides, type, note, config.placementKeys]);

  /**
   * The catalogue editor's config, with one position per photographed side:
   * the side's photo laid under the position's own field, the type's limits
   * on characters and foam, and the per-side fee as the position's price.
   */
  const designConfig: EditorConfig | null = useMemo(() => {
    if (!sides.length || !type || !customerItems) return null;
    const placements = sides.flatMap((sd, i) => {
      const key = config.placementKeys[i];
      const base = editorConfig.placements.find((p) => p.key === key);
      const item = customerItems[key];
      if (!base || !item) return [];
      return [
        {
          ...base,
          label: c.sideN.replace("{n}", String(i + 1)),
          hint: null,
          imageUrl: sd.url,
          corners: item.corners,
          maxChars: type.maxChars,
          allowPuff: base.allowPuff && type.allowPuff,
          // Handling and return, charged per side — the server adds the same.
          priceCents: type.priceCents,
        },
      ];
    });
    return placements.length ? { ...editorConfig, placements } : null;
  }, [editorConfig, config.placementKeys, sides, type, customerItems, c.sideN]);

  if (step === "design" && designConfig && customerItems && type) {
    return (
      <PersonalizationEditor
        locale={locale}
        config={designConfig}
        product={{ id: config.productId, slug: config.productSlug, title: c.title, imageUrl: null, basePriceCents: 0 }}
        // The line itself costs nothing: every charge is a side's own.
        variant={{ id: type.variantId, label: type.label, priceCents: 0 }}
        customerItems={customerItems}
        back={{ label: c.backToItem, onClick: () => setStep("item") }}
        precedingSteps={[{ label: c.steps.item, onClick: () => setStep("item") }]}
        noteField={{ title: c.noteTitle, hint: c.noteHint, placeholder: c.notePlaceholder, value: note, onChange: setNote, maxLength: 500 }}
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <Link href={`/${locale}`} className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{t.shop.continueShopping}</span>
        </Link>
        <div className={styles.topTitle}>
          <span className={styles.eyebrow}>{c.eyebrow}</span>
          <h1 className={styles.title}>{c.title}</h1>
        </div>
      </header>

      {/* The same rail the editor continues: this step, then the editor's own. */}
      <ol className={styles.stepRail} aria-label={c.howTitle}>
        {[c.steps.item, c.steps.design, t.personalize.steps.review].map((label, i) => (
          <li key={label} className={styles.stepRailItem}>
            <button type="button" className={`${styles.stepDot} ${i === 0 ? styles.stepDotActive : ""}`} disabled={i > 0} aria-current={i === 0 ? "step" : undefined}>
              <span className={styles.stepNum}>{i + 1}</span>
              <span className={styles.stepName}>{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className={styles.layout}>
        <div className={styles.column}>
          <fieldset className={styles.panel}>
            <legend className={styles.panelTitle}>
              <Shirt size={15} aria-hidden="true" /> {c.itemTitle}
            </legend>
            <p className={styles.panelHint}>{c.itemHint}</p>
            <div className={styles.typeGrid} role="radiogroup" aria-label={c.itemTitle}>
              {config.itemTypes.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  role="radio"
                  aria-checked={it.key === type?.key}
                  className={`${styles.typeCard} ${it.key === type?.key ? styles.typeCardActive : ""}`}
                  onClick={() => setTypeKey(it.key)}
                >
                  {it.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imageUrl} alt="" className={styles.typeImage} />
                  )}
                  <span className={styles.typeLabel}>{it.label}</span>
                  {it.hint && <span className={styles.typeHint}>{it.hint}</span>}
                  <span className={styles.typePrice}>+€{euros(it.priceCents)}</span>
                </button>
              ))}
            </div>
            <p className={styles.priceNote}>
              <strong>{c.priceHandling}</strong> — {c.priceNote}
            </p>
          </fieldset>

          <fieldset className={styles.panel}>
            <legend className={styles.panelTitle}>
              <Camera size={15} aria-hidden="true" /> {c.photoTitle}
            </legend>
            <p className={styles.panelHint}>{c.photoHint}</p>

            {sides.length > 0 && (
              <ol className={styles.sideList}>
                {sides.map((sd, i) => (
                  <li key={sd.key} className={styles.sideCard}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sd.preview} alt="" className={styles.sideThumb} />
                    <div className={styles.sideBody}>
                      <span className={styles.sideTitle}>
                        {c.sideN.replace("{n}", String(i + 1))}
                        {type && <span className={styles.sidePrice}> · +€{euros(type.priceCents)}</span>}
                      </span>
                    </div>
                    <button type="button" className={styles.sideRemove} onClick={() => removeSide(sd.key)} aria-label={c.removeSide} title={c.removeSide}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {sides.length < config.maxSides && (
              <label className={`${styles.dropzone} ${sides.length ? styles.dropzoneSmall : ""}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className={styles.srOnly}
                  onChange={(e) => {
                    void onPickPhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                  disabled={uploading}
                />
                <span className={styles.dropzoneEmpty}>
                  <ImagePlus size={sides.length ? 18 : 26} aria-hidden="true" />
                </span>
                <span className={styles.dropzoneLabel}>
                  {uploading ? (
                    <>
                      <Loader2 size={14} className={styles.spin} aria-hidden="true" /> {c.photoUploading}
                    </>
                  ) : sides.length ? (
                    c.addSide
                  ) : (
                    c.photoAdd
                  )}
                </span>
              </label>
            )}
            {type && <p className={styles.priceNote}>{c.sidesNote.replace("{price}", `€${euros(type.priceCents)}`)}</p>}
            {uploadError && (
              <p className={styles.errorBox} role="alert">
                {uploadError}
              </p>
            )}
          </fieldset>
        </div>

        <aside className={styles.column}>
          <div className={styles.howCard}>
            <h2 className={styles.howTitle}>{c.howTitle}</h2>
            <ol className={styles.howList}>
              {c.how.map((line, i) => (
                <li key={i}>
                  <span className={styles.howNum}>{i + 1}</span>
                  {line}
                </li>
              ))}
            </ol>
            <p className={styles.howIntro}>{c.intro}</p>
          </div>
        </aside>
      </div>

      <div className={styles.actionBar}>
        <div className={styles.priceBlock}>
          {type && (
            <>
              <span className={styles.priceLabel}>
                {c.priceHandling}
                {sides.length > 1 && ` · ${c.sideCount.replace("{n}", String(sides.length))}`}
              </span>
              <span className={styles.priceValue}>€{euros(type.priceCents * Math.max(1, sides.length))}</span>
            </>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} disabled={!designConfig || uploading} onClick={() => setStep("design")}>
            {c.toDesign} <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
