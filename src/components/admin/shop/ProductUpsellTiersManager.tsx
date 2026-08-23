"use client";

import { useState } from "react";
import { Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import type { ProductUpsellTier } from "@/lib/shop/productContent.types";
import styles from "./ProductUpsellTiersManager.module.css";

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface Props {
  initialTiers: ProductUpsellTier[];
  /** The product's regular unit price, cents — used to compute the savings hint. */
  basePriceCents: number;
  onChange: (items: ProductUpsellTier[]) => void;
}

export default function ProductUpsellTiersManager({ initialTiers, basePriceCents, onChange }: Props) {
  const [items, setItems] = useState<ProductUpsellTier[]>(initialTiers);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function notify(next: ProductUpsellTier[]) {
    const reordered = next.map((t, i) => ({ ...t, sortOrder: i }));
    setItems(reordered);
    onChange(reordered);
  }

  function addTier() {
    const lastQty = items.length ? Math.max(...items.map(t => t.quantity)) : 1;
    notify([...items, {
      id: genId(),
      quantity: lastQty + 1,
      unitPriceCents: basePriceCents,
      active: true,
      sortOrder: items.length,
    }]);
  }

  function update(index: number, patch: Partial<ProductUpsellTier>) {
    notify(items.map((t, i) => (i === index ? { ...t, ...patch } : t)));
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

  const duplicateQuantities = new Set(
    items.map(t => t.quantity).filter((q, i, arr) => arr.indexOf(q) !== i)
  );

  return (
    <div>
      {items.length === 0 && (
        <p className={styles.empty}>No quantity tiers yet. Add one to encourage a bigger order.</p>
      )}

      <div className={styles.list}>
        {items.map((tier, i) => {
          const savingsPct = basePriceCents > 0 && tier.unitPriceCents < basePriceCents
            ? Math.round((1 - tier.unitPriceCents / basePriceCents) * 100)
            : null;
          const isDuplicate = duplicateQuantities.has(tier.quantity);
          return (
            <div
              key={tier.id}
              className={`${styles.card} ${dragIndex === i ? styles.cardDragging : ""} ${!tier.active ? styles.cardInactive : ""}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => setDragIndex(null)}
            >
              <div className={styles.cardHead}>
                <span className={styles.dragHandle}><GripVertical size={16} /></span>
                <span className={styles.cardTitle}>Tier {i + 1}</span>
                <button
                  type="button"
                  className={styles.toggleBtn}
                  onClick={() => update(i, { active: !tier.active })}
                  title={tier.active ? "Active — shown to customers" : "Inactive — hidden from customers"}
                >
                  {tier.active ? <Eye size={15} /> : <EyeOff size={15} />}
                  {tier.active ? "Active" : "Inactive"}
                </button>
                <button type="button" className={styles.removeBtn} onClick={() => remove(i)} title="Remove">
                  <Trash2 size={15} />
                </button>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Buy quantity</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className={`${styles.numberInput} ${isDuplicate ? styles.numberInputError : ""}`}
                      value={tier.quantity}
                      onChange={e => update(i, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                    />
                  </label>
                  <label className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Price each</span>
                    <div className={styles.priceInputWrap}>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className={styles.numberInput}
                        value={tier.unitPriceCents / 100}
                        onChange={e => update(i, { unitPriceCents: Math.max(0, Math.round(Number(e.target.value) * 100) || 0) })}
                      />
                      <span className={styles.priceSuffix}>€</span>
                    </div>
                  </label>
                </div>
                {isDuplicate ? (
                  <p className={styles.errorHint}>Another tier already uses this quantity.</p>
                ) : savingsPct !== null ? (
                  <p className={styles.savingsHint}>−{savingsPct}% vs. the regular price</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" className={styles.addBtn} onClick={addTier}>
        <Plus size={16} />
        <span>Add tier</span>
      </button>

      <p className={styles.hint}>
        Drag to reorder · a customer paying for N units gets the highest-quantity active tier
        their order qualifies for · only active tiers are shown on the product page.
      </p>
    </div>
  );
}
