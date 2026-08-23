"use client";

import { useState } from "react";
import { GripVertical, Trash2, Plus } from "lucide-react";
import BilingualField from "@/components/admin/BilingualField";
import SectionGenerateButton from "@/components/admin/SectionGenerateButton";
import TrustBadgeIconSelect from "./TrustBadgeIconSelect";
import { useSectionGenerate } from "@/hooks/useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import { OVERLAY_LANGS, type OverlayLang } from "@/hooks/useEntityTranslations";
import type { ProductTrustBadge } from "@/lib/shop/productContent.types";
import styles from "./ProductTrustBadgesManager.module.css";

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface Props {
  initialBadges: ProductTrustBadge[];
  translations: Record<OverlayLang, Record<string, string>>;
  onTranslationChange: (lang: OverlayLang, field: string, value: string) => void;
  onChange: (items: ProductTrustBadge[]) => void;
}

/** Icon + title/subtitle "trust signal" shown near the PDP buy box (e.g. "Secure checkout"). */
export default function ProductTrustBadgesManager({ initialBadges, translations, onTranslationChange, onChange }: Props) {
  const [badges, setBadges] = useState<ProductTrustBadge[]>(initialBadges);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [itemError, setItemError] = useState<{ id: string; message: string } | null>(null);
  const generator = useSectionGenerate<SectionTranslationOutcome<{ title: string; subtitle: string }>>(
    "/next-api/admin/shop/products/sections/trust-badges/translate",
  );

  function notify(next: ProductTrustBadge[]) {
    const reordered = next.map((b, i) => ({ ...b, sortOrder: i }));
    setBadges(reordered);
    onChange(reordered);
  }

  async function generateItem(index: number) {
    const badge = badges[index];
    const enTitle = badge.title?.trim();
    if (!enTitle) {
      setItemError({ id: badge.id, message: "Write the English badge title first." });
      return;
    }
    const enSubtitle = badge.subtitle?.trim() ?? "";
    setItemError(null);
    setGeneratingIds(prev => new Set(prev).add(badge.id));
    try {
      const outcome = await generator.generate({ title: enTitle, subtitle: enSubtitle });
      if (!outcome) {
        setItemError({ id: badge.id, message: "Generation failed — try again." });
        return;
      }
      // A failed language comes back as an empty string (see TranslationService) —
      // never let that blank out content the admin already wrote.
      OVERLAY_LANGS.forEach(lang => {
        const langResult = outcome.result[lang];
        if (langResult?.title) onTranslationChange(lang, `trustBadge:${badge.id}:title`, langResult.title);
        if (langResult?.subtitle) onTranslationChange(lang, `trustBadge:${badge.id}:subtitle`, langResult.subtitle);
      });
      const errorSummary = summarizeGenerateErrors(outcome.errors);
      if (errorSummary) setItemError({ id: badge.id, message: errorSummary });
    } finally {
      setGeneratingIds(prev => { const next = new Set(prev); next.delete(badge.id); return next; });
    }
  }

  function addBadge() {
    notify([...badges, { id: genId(), icon: "BadgeCheck", title: "", subtitle: "", link: "", sortOrder: badges.length }]);
  }

  function update(index: number, patch: Partial<ProductTrustBadge>) {
    notify(badges.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function remove(index: number) {
    notify(badges.filter((_, i) => i !== index));
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    const next = [...badges];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    notify(next);
  }

  return (
    <div>
      {badges.length === 0 && (
        <p className={styles.empty}>No badges yet. The page will show the default &ldquo;Secure checkout / Free shipping / Easy returns&rdquo; signals.</p>
      )}

      <div className={styles.list}>
        {badges.map((badge, i) => (
          <div
            key={badge.id}
            className={`${styles.card} ${dragIndex === i ? styles.cardDragging : ""}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => setDragIndex(null)}
          >
            <div className={styles.cardHead}>
              <span className={styles.dragHandle}><GripVertical size={16} /></span>
              <TrustBadgeIconSelect
                value={badge.icon}
                onChange={icon => update(i, { icon })}
              />
              <SectionGenerateButton
                onClick={() => generateItem(i)}
                generating={generatingIds.has(badge.id)}
                title="Write the English title first, then generate the other languages"
              />
              <button type="button" className={styles.removeBtn} onClick={() => remove(i)} title="Remove">
                <Trash2 size={15} />
              </button>
            </div>

            {itemError?.id === badge.id && (
              <p className={styles.itemError}>{itemError.message}</p>
            )}

            <div className={styles.cardBody}>
              <BilingualField
                label="Badge title"
                field={`trustBadge:${badge.id}:title`}
                baseValue={badge.title}
                baseOnChange={val => update(i, { title: val })}
                basePlaceholder="e.g. Secure checkout"
                baseRequired
                translations={translations}
                onTranslationChange={onTranslationChange}
                overlayPlaceholder="e.g. Paiement 100% sécurisé"
              />
              <BilingualField
                label="Subtitle (optional)"
                field={`trustBadge:${badge.id}:subtitle`}
                baseValue={badge.subtitle ?? ""}
                baseOnChange={val => update(i, { subtitle: val })}
                basePlaceholder="e.g. 100% secure payment"
                translations={translations}
                onTranslationChange={onTranslationChange}
                overlayPlaceholder="e.g. Paiement 100% sécurisé"
              />
              <label className={styles.linkField}>
                <span className={styles.linkLabel}>Link (optional)</span>
                <input
                  className={styles.linkInput}
                  type="text"
                  value={badge.link ?? ""}
                  onChange={e => update(i, { link: e.target.value })}
                  placeholder="e.g. /shipping-policy"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className={styles.addBtn} onClick={addBadge}>
        <Plus size={16} />
        <span>Add badge</span>
      </button>

      <p className={styles.hint}>Drag to reorder · only badges with a label are shown on the product page.</p>
    </div>
  );
}
