"use client";

import { useState } from "react";
import { GripVertical, Trash2, Plus } from "lucide-react";
import BilingualField from "@/components/admin/BilingualField";
import { useSectionGenerate } from "@/hooks/useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import { OVERLAY_LANGS, type OverlayLang } from "@/hooks/useEntityTranslations";
import type { ProductInfoSection } from "@/lib/shop/productContent.types";
import styles from "./ProductInfoSectionsManager.module.css";
import peStyles from "@/app/admin/shop/products/ProductEdit.module.css";

interface InfoSectionTranslation {
  label: string;
  value: string;
}

interface Props {
  initialSections: ProductInfoSection[];
  translations: Record<OverlayLang, Record<string, string>>;
  onTranslationChange: (lang: OverlayLang, field: string, value: string) => void;
  onChange: (sections: ProductInfoSection[]) => void;
}

export default function ProductInfoSectionsManager({ initialSections, translations, onTranslationChange, onChange }: Props) {
  const [items, setItems] = useState<ProductInfoSection[]>(initialSections);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [itemError, setItemError] = useState<{ id: string; message: string } | null>(null);
  const generator = useSectionGenerate<SectionTranslationOutcome<InfoSectionTranslation>>(
    "/next-api/admin/shop/products/sections/info-sections/translate",
  );

  function notify(next: ProductInfoSection[]) {
    const reordered = next.map((s, i) => ({ ...s, sortOrder: i }));
    setItems(reordered);
    onChange(reordered);
  }

  function update(index: number, patch: Partial<ProductInfoSection>) {
    notify(items.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSection() {
    notify([...items, { id: crypto.randomUUID(), key: "custom", label: "", value: "", sortOrder: items.length }]);
  }

  function remove(index: number) {
    notify(items.filter((_, i) => i !== index));
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    notify(next);
  }

  async function generateItem(id: string) {
    const section = items.find(s => s.id === id);
    if (!section) return;
    const label = section.label.trim();
    const value = section.value.trim();
    if (!label || !value) {
      setItemError({ id, message: "Write the English title and content first." });
      return;
    }
    setItemError(null);
    setGeneratingIds(prev => new Set(prev).add(id));
    try {
      const outcome = await generator.generate({ label, value });
      if (!outcome) {
        setItemError({ id, message: "Generation failed — try again." });
        return;
      }
      OVERLAY_LANGS.forEach(lang => {
        const langResult = outcome.result[lang];
        if (langResult?.label) onTranslationChange(lang, `infoSection:${id}:label`, langResult.label);
        if (langResult?.value) onTranslationChange(lang, `infoSection:${id}:value`, langResult.value);
      });
      const errorSummary = summarizeGenerateErrors(outcome.errors);
      if (errorSummary) setItemError({ id, message: errorSummary });
    } finally {
      setGeneratingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  return (
    <div>
      {items.length === 0 && (
        <p className={styles.empty}>No sections yet. Add &quot;Composition&quot;, &quot;Care instructions&quot;, &quot;Target audience&quot;...</p>
      )}

      <div className={styles.list}>
        {items.map((section, i) => (
          <div
            key={section.id}
            className={`${styles.card} ${dragIndex === i ? styles.cardDragging : ""}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => setDragIndex(null)}
          >
            <div className={styles.cardHead}>
              <span className={styles.dragHandle}><GripVertical size={16} /></span>
              <span className={styles.cardHeadLabel}>Specification</span>
              <button type="button" className={styles.removeBtn} onClick={() => remove(i)} title="Remove">
                <Trash2 size={14} />
              </button>
            </div>

            {itemError?.id === section.id && (
              <p className={styles.itemError}>{itemError.message}</p>
            )}

            <div className={styles.cardBody}>
              <BilingualField
                label="Section title"
                field={`infoSection:${section.id}:label`}
                baseValue={section.label}
                baseOnChange={val => update(i, { label: val })}
                basePlaceholder="e.g. Composition"
                baseRequired
                translations={translations}
                onTranslationChange={onTranslationChange}
                overlayPlaceholder="e.g. Composition"
                onGenerate={() => generateItem(section.id)}
                generating={generatingIds.has(section.id)}
                generateError={itemError?.id === section.id ? itemError.message : null}
              />
              <BilingualField
                label="Content"
                field={`infoSection:${section.id}:value`}
                baseValue={section.value}
                baseOnChange={val => update(i, { value: val })}
                basePlaceholder="e.g. 100% organic cotton"
                multiline
                rows={3}
                translations={translations}
                onTranslationChange={onTranslationChange}
                overlayPlaceholder="e.g. 100% organic cotton"
                onGenerate={() => generateItem(section.id)}
                generating={generatingIds.has(section.id)}
              />
            </div>
          </div>
        ))}
      </div>

      <button type="button" className={styles.addBtn} onClick={addSection}>
        <Plus size={16} />
        <span>Add section</span>
      </button>

      <p className={peStyles.hint}>Drag to reorder · only non-empty sections are shown on the product page.</p>
    </div>
  );
}
