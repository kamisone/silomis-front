"use client";

import { useState } from "react";
import { GripVertical, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import BilingualField from "@/components/admin/BilingualField";
import { useSectionGenerate } from "@/hooks/useSectionGenerate";
import { summarizeGenerateErrors, type SectionTranslationOutcome } from "@/lib/sectionTranslate";
import { OVERLAY_LANGS, type OverlayLang } from "@/hooks/useEntityTranslations";
import type { ProductFaq } from "@/lib/shop/productContent.types";
import styles from "./ProductFaqsManager.module.css";
import peStyles from "@/app/admin/shop/products/ProductEdit.module.css";

interface FaqTranslation {
  question: string;
  answer: string;
}

interface Props {
  initialFaqs: ProductFaq[];
  translations: Record<OverlayLang, Record<string, string>>;
  onTranslationChange: (lang: OverlayLang, field: string, value: string) => void;
  onChange: (faqs: ProductFaq[]) => void;
}

export default function ProductFaqsManager({ initialFaqs, translations, onTranslationChange, onChange }: Props) {
  const [items, setItems] = useState<ProductFaq[]>(initialFaqs);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [itemError, setItemError] = useState<{ id: string; message: string } | null>(null);
  const generator = useSectionGenerate<SectionTranslationOutcome<FaqTranslation>>(
    "/next-api/admin/shop/products/sections/faqs/translate",
  );

  function notify(next: ProductFaq[]) {
    const reordered = next.map((f, i) => ({ ...f, sortOrder: i }));
    setItems(reordered);
    onChange(reordered);
  }

  function update(index: number, patch: Partial<ProductFaq>) {
    notify(items.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addFaq() {
    notify([...items, { id: crypto.randomUUID(), question: "", answer: "", sortOrder: items.length, isActive: true }]);
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
    const faq = items.find(f => f.id === id);
    if (!faq) return;
    const question = faq.question.trim();
    const answer = faq.answer.trim();
    if (!question || !answer) {
      setItemError({ id, message: "Write the English question and answer first." });
      return;
    }
    setItemError(null);
    setGeneratingIds(prev => new Set(prev).add(id));
    try {
      const outcome = await generator.generate({ question, answer });
      if (!outcome) {
        setItemError({ id, message: "Generation failed — try again." });
        return;
      }
      OVERLAY_LANGS.forEach(lang => {
        const langResult = outcome.result[lang];
        if (langResult?.question) onTranslationChange(lang, `faq:${id}:question`, langResult.question);
        if (langResult?.answer) onTranslationChange(lang, `faq:${id}:answer`, langResult.answer);
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
        <p className={styles.empty}>No FAQs yet. Add common questions about this product.</p>
      )}

      <div className={styles.list}>
        {items.map((faq, i) => (
          <div
            key={faq.id}
            className={`${styles.card} ${dragIndex === i ? styles.cardDragging : ""} ${!faq.isActive ? styles.cardInactive : ""}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => setDragIndex(null)}
          >
            <div className={styles.cardHead}>
              <span className={styles.dragHandle}><GripVertical size={16} /></span>
              <span className={styles.cardTitle}>FAQ {i + 1}</span>
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => update(i, { isActive: !faq.isActive })}
                title={faq.isActive ? "Active — visible on product page" : "Inactive — hidden from product page"}
              >
                {faq.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                {faq.isActive ? "Active" : "Inactive"}
              </button>
              <button type="button" className={styles.removeBtn} onClick={() => remove(i)} title="Remove">
                <Trash2 size={14} />
              </button>
            </div>

            {itemError?.id === faq.id && (
              <p className={styles.itemError}>{itemError.message}</p>
            )}

            <div className={styles.cardBody}>
              <BilingualField
                label="Question"
                field={`faq:${faq.id}:question`}
                baseValue={faq.question}
                baseOnChange={val => update(i, { question: val })}
                basePlaceholder="e.g. How long does delivery take?"
                baseRequired
                translations={translations}
                onTranslationChange={onTranslationChange}
                overlayPlaceholder="e.g. How long does delivery take?"
                onGenerate={() => generateItem(faq.id)}
                generating={generatingIds.has(faq.id)}
                generateError={itemError?.id === faq.id ? itemError.message : null}
              />
              <BilingualField
                label="Answer"
                field={`faq:${faq.id}:answer`}
                baseValue={faq.answer}
                baseOnChange={val => update(i, { answer: val })}
                basePlaceholder="e.g. Orders ship within 2-3 business days."
                multiline
                rows={3}
                translations={translations}
                onTranslationChange={onTranslationChange}
                overlayPlaceholder="e.g. Orders ship within 2-3 business days."
                onGenerate={() => generateItem(faq.id)}
                generating={generatingIds.has(faq.id)}
              />
            </div>
          </div>
        ))}
      </div>

      <button type="button" className={styles.addBtn} onClick={addFaq}>
        <Plus size={16} />
        <span>Add FAQ</span>
      </button>

      <p className={peStyles.hint}>Drag to reorder · only active FAQs with both a question and an answer are shown on the product page.</p>
    </div>
  );
}
